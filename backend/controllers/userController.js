import mongoose from 'mongoose';
import User from '../models/user/user.js';
import Admin from '../models/admin/admin.js';
import Payment from '../models/payment/payment.js';
import bcrypt from 'bcryptjs';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { signUserToken, verifyUserToken } from '../utils/userJwt.js';
import { invalidateAdminReadCaches } from '../services/cacheInvalidationService.js';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const MASKED_DEVICE = 'Unknown Device';

const normalizeDeviceName = (value) => {
    const raw = (value || '').toString().trim();
    if (!raw) return '';
    if (raw.length <= 80) return raw;
    return `${raw.slice(0, 77)}...`;
};

const prettifyDeviceName = (deviceId) => {
    const raw = (deviceId || '').toString().trim();
    if (!raw) return MASKED_DEVICE;
    if (raw.startsWith('web-')) return 'Web Browser';
    if (raw.length <= 16) return raw;
    return `${raw.slice(0, 10)}...${raw.slice(-4)}`;
};

const getActiveDevices = (userDoc) => {
    const activeId = String(userDoc?.lastLoginDeviceId || '').trim();
    const devices = Array.isArray(userDoc?.loginDevices) ? userDoc.loginDevices : [];
    if (!activeId) return [];

    const found = devices.find((d) => String(d?.deviceId || '') === activeId);
    const lastSeen = found?.lastLoginAt || userDoc?.lastActiveAt || userDoc?.updatedAt || new Date();
    return [{
        deviceId: activeId,
        deviceName: normalizeDeviceName(found?.deviceName || userDoc?.lastLoginDeviceName) || prettifyDeviceName(activeId),
        lastSeenAt: lastSeen,
    }];
};

const addWalletBalanceToUsers = async (users) => {
    if (!users || users.length === 0) return users;
    const userIds = users.map((u) => u._id);
    const wallets = await Wallet.find({ userId: { $in: userIds } }).select('userId balance').lean();
    const walletMap = Object.fromEntries(wallets.map((w) => [String(w.userId), w.balance ?? 0]));
    return users.map((u) => ({ ...u, walletBalance: walletMap[String(u._id)] ?? 0 }));
};

const addOnlineStatus = (users) => {
    const now = Date.now();
    return users.map((u) => {
        const lastActive = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0;
        const isOnline = lastActive > 0 && now - lastActive < ONLINE_THRESHOLD_MS;
        return { ...u, isOnline };
    });
};

export const userLogin = async (req, res) => {
    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const { username, phone, password, deviceId, deviceName } = req.body;

        // Support both username and phone for login (admin-created players use phone + password)
        const loginIdentifier = phone || username;

        if (!loginIdentifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Phone number (or username) and password are required',
            });
        }

        // Normalize phone to digits only so lookup matches stored value (e.g. admin-created users store 10 digits)
        const normalizedPhone = phone ? String(phone).replace(/\D/g, '').slice(0, 10) : '';

        // Try to find user by phone first, then by username
        let user = normalizedPhone.length >= 10 ? await User.findOne({ phone: normalizedPhone }) : null;
        if (!user && username) {
            user = await User.findOne({ username: String(username).trim() });
        }
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been suspended. Please contact admin for assistance.',
                code: 'ACCOUNT_SUSPENDED',
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        const clientIp = getClientIp(req);
        const rawDeviceId = req.body != null && 'deviceId' in req.body ? req.body.deviceId : deviceId;
        const trimmedDeviceId = (rawDeviceId != null && String(rawDeviceId).trim()) ? String(rawDeviceId).trim() : '';
        const resolvedDeviceName = normalizeDeviceName(req.body?.deviceName ?? deviceName);

        const activeDeviceId = String(user.lastLoginDeviceId || '').trim();
        if (trimmedDeviceId && activeDeviceId && activeDeviceId !== trimmedDeviceId) {
            return res.status(409).json({
                success: false,
                code: 'DEVICE_LIMIT_REACHED',
                message: 'Login pending, device limit reached. Log out 1 device to continue.',
                data: {
                    activeDevices: getActiveDevices(user),
                    limit: 1,
                },
            });
        }

        const sessionVersion = Date.now();
        const update = {
            lastActiveAt: new Date(),
            lastLoginIp: clientIp || undefined,
            sessionVersion,
            ...(trimmedDeviceId ? { lastLoginDeviceId: trimmedDeviceId } : {}),
            ...(resolvedDeviceName ? { lastLoginDeviceName: resolvedDeviceName } : {}),
        };
        await User.updateOne({ _id: user._id }, { $set: update });

        if (trimmedDeviceId) {
            const doc = await User.findById(user._id).select('loginDevices').lean();
            const loginDevices = Array.isArray(doc?.loginDevices) ? [...doc.loginDevices] : [];
            const now = new Date();
            const idx = loginDevices.findIndex((d) => String(d.deviceId) === trimmedDeviceId);
            if (idx >= 0) {
                loginDevices[idx].lastLoginAt = now;
                if (resolvedDeviceName) {
                    loginDevices[idx].deviceName = resolvedDeviceName;
                }
            } else {
                loginDevices.push({
                    deviceId: trimmedDeviceId,
                    deviceName: resolvedDeviceName || '',
                    firstLoginAt: now,
                    lastLoginAt: now,
                });
            }
            await User.updateOne({ _id: user._id }, { $set: { loginDevices } });
        }

        await logActivity({
            action: 'player_login',
            performedBy: user.username,
            performedByType: 'user',
            targetType: 'user',
            targetId: user._id.toString(),
            details: `Player "${user.username}" logged in (frontend)`,
            ip: getClientIp(req),
        });

        // Get wallet balance
        const wallet = await Wallet.findOne({ userId: user._id });
        const balance = wallet ? wallet.balance : 0;

        const token = signUserToken({ _id: user._id, sessionVersion });
        await User.updateOne(
            { _id: user._id },
            { $set: { currentAuthToken: token, updatedAt: new Date() } }
        );
        // Also store auth token as httpOnly cookie so direct URL-bar API checks can work in browser.
        res.cookie('userToken', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            ...(isProduction ? {} : { domain: 'localhost' }),
            path: '/',
        });
        const data = {
            id: user._id,
            username: user.username,
            email: user.email,
            phone: user.phone || '',
            role: user.role,
            balance: balance,
            token,
        };
        if (user.referredBy) {
            data.referredBy = user.referredBy;
            const bookie = await Admin.findById(user.referredBy).select('uiTheme').lean();
            data.bookieTheme = bookie?.uiTheme || { themeId: 'default' };
        }

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const userHeartbeat = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        }
        const user = await User.findById(userId).select('isActive').lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found', code: 'ACCOUNT_SUSPENDED' });
        }
        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });
        }
        await User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date() } });
        res.status(200).json({ success: true, message: 'Heartbeat updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const userLogout = async (req, res) => {
    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const authHeader = req.headers.authorization;
        const bearerToken = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7).trim()
            : '';
        const cookieToken = req.cookies?.userToken ? String(req.cookies.userToken).trim() : '';
        const token = bearerToken || cookieToken;

        if (token) {
            try {
                const payload = verifyUserToken(token);
                const userId = payload?.userId;
                if (userId) {
                    const current = await User.findById(userId).select('sessionVersion currentAuthToken').lean();
                    const tokenSv = Number(payload?.sv);
                    const currentSv = Number(current?.sessionVersion);
                    const activeToken = current?.currentAuthToken ? String(current.currentAuthToken).trim() : '';
                    const providedToken = String(token).trim();
                    if (
                        !Number.isFinite(tokenSv) ||
                        !Number.isFinite(currentSv) ||
                        tokenSv === currentSv ||
                        (activeToken && activeToken === providedToken)
                    ) {
                        await User.updateOne(
                            { _id: userId },
                            { $set: { sessionVersion: Date.now(), lastLoginDeviceId: null, currentAuthToken: null } }
                        );
                    }
                }
            } catch {
                // Ignore token parse errors; cookie will still be cleared.
            }
        }

        res.clearCookie('userToken', {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            ...(isProduction ? {} : { domain: 'localhost' }),
            path: '/',
        });
        return res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Logout failed' });
    }
};

export const logoutDeviceForSingleLogin = async (req, res) => {
    try {
        const { username, phone, password, deviceId } = req.body || {};
        const loginIdentifier = phone || username;
        if (!loginIdentifier || !password || !deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Phone/username, password and deviceId are required',
            });
        }

        const normalizedPhone = phone ? String(phone).replace(/\D/g, '').slice(0, 10) : '';
        let user = normalizedPhone.length >= 10 ? await User.findOne({ phone: normalizedPhone }) : null;
        if (!user && username) user = await User.findOne({ username: String(username).trim() });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const isPasswordValid = await bcrypt.compare(String(password), user.password);
        if (!isPasswordValid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const targetDeviceId = String(deviceId).trim();
        const activeDeviceId = String(user.lastLoginDeviceId || '').trim();
        if (!activeDeviceId || activeDeviceId !== targetDeviceId) {
            return res.status(404).json({
                success: false,
                message: 'Device is not active',
            });
        }

        await User.updateOne(
            { _id: user._id },
            { $set: { sessionVersion: Date.now(), lastLoginDeviceId: null, currentAuthToken: null } }
        );

        return res.status(200).json({
            success: true,
            message: 'Device logged out successfully',
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getCurrentUserProfile = async (userId) => {
    const user = await User.findById(userId).select('username phone isActive').lean();
    if (!user) return { error: { status: 404, message: 'User not found' } };
    if (!user.isActive) return { error: { status: 403, message: 'Account suspended', code: 'ACCOUNT_SUSPENDED' } };

    const wallet = await Wallet.findOne({ userId }).select('balance').lean();
    return {
        user: {
            username: user.username || '',
            phone: user.phone || '',
            balance: Number(wallet?.balance || 0),
        },
    };
};

export const getMyBalance = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        }

        const result = await getCurrentUserProfile(userId);
        if (result.error) {
            return res.status(result.error.status).json({
                success: false,
                message: result.error.message,
                ...(result.error.code ? { code: result.error.code } : {}),
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                playerId: String(userId),
                balance: result.user.balance,
                currency: 'INR',
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyUsername = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        }

        const result = await getCurrentUserProfile(userId);
        if (result.error) {
            return res.status(result.error.status).json({
                success: false,
                message: result.error.message,
                ...(result.error.code ? { code: result.error.code } : {}),
            });
        }

        return res.status(200).json({
            success: true,
            data: { username: result.user.username },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyPhone = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        }

        const result = await getCurrentUserProfile(userId);
        if (result.error) {
            return res.status(result.error.status).json({
                success: false,
                message: result.error.message,
                ...(result.error.code ? { code: result.error.code } : {}),
            });
        }

        return res.status(200).json({
            success: true,
            data: { phone: result.user.phone },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const toCreditDebitItem = (payment, userId) => ({
    playerId: String(userId),
    amount: Number(payment.amount || 0),
    transactionId: payment.upiTransactionId || payment.transactionId || String(payment._id),
});

const getMyCreditDebitEntries = async (userId, type) => {
    const payments = await Payment.find({ userId, type })
        .select('_id amount upiTransactionId transactionId status createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    return payments.map((payment) => toCreditDebitItem(payment, userId));
};

export const getMyProfile = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        }

        const result = await getCurrentUserProfile(userId);
        if (result.error) {
            return res.status(result.error.status).json({
                success: false,
                message: result.error.message,
                ...(result.error.code ? { code: result.error.code } : {}),
            });
        }

        const credit = await getMyCreditDebitEntries(userId, 'deposit');
        const debit = await getMyCreditDebitEntries(userId, 'withdrawal');
        return res.status(200).json({
            success: true,
            data: {
                id: userId,
                username: result.user.username,
                balance: result.user.balance,
                phone: result.user.phone,
                credit,
                debit,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyCredit = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        }

        const result = await getCurrentUserProfile(userId);
        if (result.error) {
            return res.status(result.error.status).json({
                success: false,
                message: result.error.message,
                ...(result.error.code ? { code: result.error.code } : {}),
            });
        }

        return res.status(200).json({
            success: true,
            data: await getMyCreditDebitEntries(userId, 'deposit'),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyDebit = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        }

        const result = await getCurrentUserProfile(userId);
        if (result.error) {
            return res.status(result.error.status).json({
                success: false,
                message: result.error.message,
                ...(result.error.code ? { code: result.error.code } : {}),
            });
        }

        const debitEntries = await getMyCreditDebitEntries(userId, 'withdrawal');
        return res.status(200).json({
            success: true,
            data: {
                playerId: String(userId),
                balance: result.user.balance,
                transactionId: debitEntries[0]?.transactionId || '',
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const userSignup = async (req, res) => {
    try {
        const {
            username,
            firstName,
            lastName,
            email,
            password,
            phone,
            referredBy: referredByBody,
            deviceId: deviceIdBody,
            deviceName: deviceNameBody,
        } = req.body;

        const referredByRaw = referredByBody != null && String(referredByBody).trim()
            ? String(referredByBody).trim()
            : '';

        const derivedUsername = (username != null && String(username).trim())
            ? String(username).trim()
            : [firstName, lastName]
                .map((x) => (x != null ? String(x).trim() : ''))
                .filter(Boolean)
                .join(' ')
                .trim();

        if (!derivedUsername) {
            return res.status(400).json({
                success: false,
                message: 'Display name is required (username or first and last name)',
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required',
            });
        }

        if (!phone || typeof phone !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required',
            });
        }

        const trimmedPhone = phone.replace(/\D/g, '').slice(0, 10);
        if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number (starting with 6–9)',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        const emailRaw = email != null ? String(email).trim().toLowerCase() : '';
        const PLACEHOLDER_DOMAIN = '@players.internal';
        let resolvedEmail;
        if (emailRaw) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email address',
                });
            }
            resolvedEmail = emailRaw;
        } else {
            resolvedEmail = `${trimmedPhone}${PLACEHOLDER_DOMAIN}`;
        }
        const isPlaceholderEmail = resolvedEmail.endsWith(PLACEHOLDER_DOMAIN);

        let referredBy = null;
        if (referredByRaw) {
            if (!mongoose.Types.ObjectId.isValid(referredByRaw)) {
                return res.status(400).json({ success: false, message: 'Invalid referral link' });
            }
            const bookieOk = await Admin.findOne({
                _id: referredByRaw,
                role: 'bookie',
                status: 'active',
            }).select('_id').lean();
            if (!bookieOk) {
                return res.status(400).json({
                    success: false,
                    message: 'This referral link is not valid or the bookie is inactive',
                });
            }
            referredBy = new mongoose.Types.ObjectId(referredByRaw);
        }

        // Direct signup without referral → super_admin pool (visible under Super Admin Players in admin).
        const source = referredBy ? 'bookie' : 'super_admin';

        const existingUser = await User.findOne({
            $or: [
                { username: derivedUsername },
                { email: resolvedEmail },
                { phone: trimmedPhone },
            ],
        });

        if (existingUser) {
            if (existingUser.phone === trimmedPhone) {
                return res.status(409).json({ success: false, message: 'A player with this phone number already exists' });
            }
            if (existingUser.email === resolvedEmail) {
                return res.status(409).json({ success: false, message: 'A player with this email already exists' });
            }
            return res.status(409).json({ success: false, message: 'This display name is already taken' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const now = new Date();
        const sessionVersion = Date.now();
        const userDoc = {
            username: derivedUsername,
            email: resolvedEmail,
            password: hashedPassword,
            phone: trimmedPhone,
            role: 'user',
            balance: 0,
            isActive: true,
            source,
            referredBy,
            sessionVersion,
            lastActiveAt: now,
            createdAt: now,
            updatedAt: now,
        };

        const insertResult = await User.collection.insertOne(userDoc);
        const userId = insertResult.insertedId;

        await logActivity({
            action: 'player_signup',
            performedBy: derivedUsername,
            performedByType: 'user',
            targetType: 'user',
            targetId: userId.toString(),
            details: `Player "${derivedUsername}" signed up (${source === 'bookie' ? 'via bookie link' : 'direct / self signup'})`,
            meta: { email: userDoc.email, source },
            ip: getClientIp(req),
        });

        await Wallet.collection.insertOne({
            userId,
            balance: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const isProduction = process.env.NODE_ENV === 'production';
        const clientIp = getClientIp(req);
        const rawDeviceId = req.body != null && 'deviceId' in req.body ? req.body.deviceId : deviceIdBody;
        const trimmedDeviceId = (rawDeviceId != null && String(rawDeviceId).trim())
            ? String(rawDeviceId).trim()
            : '';
        const resolvedDeviceName = normalizeDeviceName(req.body?.deviceName ?? deviceNameBody);

        const loginUpdate = {
            lastActiveAt: new Date(),
            lastLoginIp: clientIp || undefined,
            ...(trimmedDeviceId ? { lastLoginDeviceId: trimmedDeviceId } : {}),
            ...(resolvedDeviceName ? { lastLoginDeviceName: resolvedDeviceName } : {}),
        };
        await User.updateOne({ _id: userId }, { $set: loginUpdate });

        if (trimmedDeviceId) {
            const doc = await User.findById(userId).select('loginDevices').lean();
            const loginDevices = Array.isArray(doc?.loginDevices) ? [...doc.loginDevices] : [];
            const devNow = new Date();
            const idx = loginDevices.findIndex((d) => String(d.deviceId) === trimmedDeviceId);
            if (idx >= 0) {
                loginDevices[idx].lastLoginAt = devNow;
                if (resolvedDeviceName) {
                    loginDevices[idx].deviceName = resolvedDeviceName;
                }
            } else {
                loginDevices.push({
                    deviceId: trimmedDeviceId,
                    deviceName: resolvedDeviceName || '',
                    firstLoginAt: devNow,
                    lastLoginAt: devNow,
                });
            }
            await User.updateOne({ _id: userId }, { $set: { loginDevices } });
        }

        const wallet = await Wallet.findOne({ userId });
        const balance = wallet ? wallet.balance : 0;
        const token = signUserToken({ _id: userId, sessionVersion });
        await User.updateOne(
            { _id: userId },
            { $set: { currentAuthToken: token, updatedAt: new Date() } }
        );
        res.cookie('userToken', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            ...(isProduction ? {} : { domain: 'localhost' }),
            path: '/',
        });

        const signupData = {
            id: userId,
            username: userDoc.username,
            phone: userDoc.phone || '',
            role: userDoc.role,
            balance,
            token,
            createdAt: now,
        };
        if (!isPlaceholderEmail) {
            signupData.email = userDoc.email;
        }
        if (referredBy) {
            signupData.referredBy = referredBy;
            const bookie = await Admin.findById(referredBy).select('uiTheme').lean();
            signupData.bookieTheme = bookie?.uiTheme || { themeId: 'default' };
        }

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: signupData,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'User with this username or email already exists',
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

const PHONE_REGEX = /^[6-9]\d{9}$/;

export const createUser = async (req, res) => {
    try {
        const { username, firstName, lastName, email, password, phone, role, balance, referredBy } = req.body;
        const initialBalance = Number(balance ?? 0);
        if (!Number.isFinite(initialBalance) || initialBalance < 0) {
            return res.status(400).json({
                success: false,
                message: 'Initial balance must be a non-negative number',
            });
        }

        // Derive username from firstName + lastName if provided (matches frontend signup flow); otherwise require username
        const derivedUsername = (firstName != null && lastName != null)
            ? `${String(firstName).trim()} ${String(lastName).trim()}`.trim()
            : (username != null ? String(username).trim() : '');

        if (!derivedUsername) {
            return res.status(400).json({
                success: false,
                message: 'Username or both First name and Last name are required',
            });
        }

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
        }

        if (!phone || typeof phone !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required (players log in with phone + password)',
            });
        }

        const trimmedPhone = phone.replace(/\D/g, '').slice(0, 10);
        if (!PHONE_REGEX.test(trimmedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number (starting with 6–9)',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        // Super admin creates → default source=super_admin, referredBy can be assigned to super_admin/bookie.
        // Bookie creates → forced source=bookie and referredBy=bookie_id.
        let finalReferredBy = (referredBy != null && String(referredBy).trim()) ? String(referredBy).trim() : null;
        let source = 'super_admin';
        if (req.admin && req.admin.role === 'bookie') {
            finalReferredBy = req.admin._id;
            source = 'bookie';
        } else if (req.admin?.role === 'super_admin' && finalReferredBy) {
            if (!mongoose.Types.ObjectId.isValid(finalReferredBy)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid assignee selected',
                });
            }
            const assignee = await Admin.findById(finalReferredBy).select('role status username').lean();
            if (!assignee || assignee.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    message: 'Selected assignee is not active or not found',
                });
            }
            // Assigned under a bookie should behave like bookie player for filters/reporting.
            source = assignee.role === 'bookie' ? 'bookie' : 'super_admin';
            finalReferredBy = assignee._id;
        } else if (req.admin?.role !== 'super_admin') {
            // Non-super-admin (and non-bookie) should not assign arbitrary admins.
            finalReferredBy = null;
        }

        // Check existing user by username, email or phone (phone must be unique for login)
        const existingUser = await User.findOne({
            $or: [
                { username: derivedUsername },
                { email: email.toLowerCase() },
                { phone: trimmedPhone },
            ],
        });
        if (existingUser) {
            if (existingUser.phone === trimmedPhone) {
                return res.status(409).json({ success: false, message: 'A player with this phone number already exists' });
            }
            if (existingUser.email === email.toLowerCase()) {
                return res.status(409).json({ success: false, message: 'A player with this email already exists' });
            }
            return res.status(409).json({ success: false, message: 'A player with this username already exists' });
        }

        // Hash password manually to avoid pre-save hook issues
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user directly in collection to bypass pre-save hook
        const userDoc = {
            username: derivedUsername,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone: trimmedPhone,
            role: role || 'user',
            balance: initialBalance,
            isActive: true,
            source,
            referredBy: finalReferredBy || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (req.admin?.role === 'bookie' && initialBalance > 0) {
            const updatedBookie = await Admin.findOneAndUpdate(
                { _id: req.admin._id, balance: { $gte: initialBalance } },
                { $inc: { balance: -initialBalance } },
                { new: true }
            ).select('balance');
            if (!updatedBookie) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient bookie balance to set initial player balance',
                });
            }
        }

        const user = await User.collection.insertOne(userDoc);
        const userId = user.insertedId;

        // Create wallet for user
        await Wallet.collection.insertOne({
            userId,
            balance: initialBalance,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        await invalidateAdminReadCaches('player_created');

        if (initialBalance > 0) {
            await WalletTransaction.create({
                userId,
                type: 'credit',
                amount: initialBalance,
                description: `${req.admin?.role === 'bookie' ? 'Bookie' : 'Admin'} credit: ₹${initialBalance} (initial balance on player creation)`,
            });
        }

        if (req.admin) {
            await logActivity({
                action: 'create_player',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'admin',
                targetType: 'user',
                targetId: userId.toString(),
                details: `Player "${derivedUsername}" created${finalReferredBy ? ' and assigned' : ''}`,
                ip: getClientIp(req),
            });
        }

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                id: userId,
                username: userDoc.username,
                email: userDoc.email,
                phone: userDoc.phone || '',
                role: userDoc.role,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'User with this username or email already exists',
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get users with optional filter.
 * filter=all (default): all users; super_admin sees all, bookie sees only their users.
 * filter=super_admin: super admin pool (source=super_admin and/or no bookie referral) — includes self-signup players.
 * filter=bookie: users where source=bookie or (referredBy!=null) - bookie's users; sorted by bookie username then createdAt.
 */
export const getUsers = async (req, res) => {
    try {
        const { filter = 'all' } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(200, Math.max(20, parseInt(req.query.limit, 10) || 100));
        const skip = (page - 1) * limit;
        const bookieUserIds = await getBookieUserIds(req.admin);
        const query = {};

        if (bookieUserIds !== null) {
            query._id = { $in: bookieUserIds };
        }

        if (filter === 'super_admin') {
            // Self-registered players have source: super_admin and referredBy: null — same pool as admin-created players.
            query.$or = [
                { source: 'super_admin' },
                { referredBy: null },
                { referredBy: { $exists: false } },
            ];
        } else if (filter === 'bookie') {
            query.referredBy = { $ne: null, $exists: true };
        }

        const [usersRaw, total] = await Promise.all([
            User.find(query)
                .select('username email phone role isActive source referredBy lastActiveAt lastLoginIp lastLoginDeviceId loginDevices createdAt toGive toTake')
                .populate('referredBy', 'username')
                .sort(filter === 'bookie' ? { referredBy: 1, createdAt: -1 } : { createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(query),
        ]);

        let users = usersRaw;

        if (filter === 'bookie' && users.length > 0) {
            users.sort((a, b) => {
                const bookieA = a.referredBy?.username || '';
                const bookieB = b.referredBy?.username || '';
                if (bookieA !== bookieB) return bookieA.localeCompare(bookieB);
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        }

        users = await addWalletBalanceToUsers(users);
        users = addOnlineStatus(users);

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                hasNextPage: skip + users.length < total,
                hasPrevPage: page > 1,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get single player by id (for admin player detail screen).
 * Bookie can only view their own referred users.
 */
export const getSingleUser = async (req, res) => {
    try {
        const { id } = req.params;
        const bookieUserIds = await getBookieUserIds(req.admin);

        const user = await User.findById(id)
            .select('username email phone role isActive source referredBy lastActiveAt lastLoginIp lastLoginDeviceId loginDevices createdAt toGive toTake')
            .populate('referredBy', 'username')
            .lean();

        if (!user) {
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        if (bookieUserIds !== null) {
            const allowed = bookieUserIds.some((uid) => uid.toString() === id);
            if (!allowed) {
                return res.status(403).json({ success: false, message: 'Access denied to this player' });
            }
        }

        const usersWithWallet = await addWalletBalanceToUsers([{ ...user, _id: user._id }]);
        const withBalance = usersWithWallet[0] || user;
        const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
        const isOnline = lastActive > 0 && Date.now() - lastActive < ONLINE_THRESHOLD_MS;

        res.status(200).json({
            success: true,
            data: {
                ...withBalance,
                walletBalance: withBalance.walletBalance ?? 0,
                isOnline,
                toGive: user.toGive ?? 0,
                toTake: user.toTake ?? 0,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update toGive and toTake for a player
 * Body: { toGive?, toTake? }
 */
export const updatePlayerToGiveToTake = async (req, res) => {
    try {
        const { id } = req.params;
        const { toGive, toTake } = req.body;
        const bookieUserIds = await getBookieUserIds(req.admin);

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        if (bookieUserIds !== null) {
            const allowed = bookieUserIds.some((uid) => uid.toString() === id);
            if (!allowed) {
                return res.status(403).json({ success: false, message: 'Access denied to this player' });
            }
        }

        if (toGive !== undefined) {
            const numToGive = Number(toGive);
            if (!Number.isFinite(numToGive) || numToGive < 0) {
                return res.status(400).json({ success: false, message: 'toGive must be a non-negative number' });
            }
            user.toGive = numToGive;
        }

        if (toTake !== undefined) {
            const numToTake = Number(toTake);
            if (!Number.isFinite(numToTake) || numToTake < 0) {
                return res.status(400).json({ success: false, message: 'toTake must be a non-negative number' });
            }
            user.toTake = numToTake;
        }

        await user.save();
        await invalidateAdminReadCaches('player_to_give_take_updated');

        await logActivity({
            action: 'update_player_to_give_take',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'user',
            targetId: user._id.toString(),
            details: `Updated toGive: ${user.toGive}, toTake: ${user.toTake} for player "${user.username}"`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            data: {
                toGive: user.toGive,
                toTake: user.toTake,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Set/reset password for a player (Admin/Bookie).
 * Body: { password }
 */
export const updatePlayerPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        const bookieUserIds = await getBookieUserIds(req.admin);

        if (!password || String(password).length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        const user = await User.findById(id).select('username');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        if (bookieUserIds !== null) {
            const allowed = bookieUserIds.some((uid) => uid.toString() === id);
            if (!allowed) {
                return res.status(403).json({ success: false, message: 'Access denied to this player' });
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(String(password), salt);
        await User.updateOne({ _id: id }, { $set: { password: hashedPassword, updatedAt: new Date() } });
        await invalidateAdminReadCaches('player_password_updated');

        await logActivity({
            action: 'reset_player_password',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'user',
            targetId: id,
            details: `Password updated for player "${user.username}"`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Player password updated successfully',
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Toggle player account status (suspend/unsuspend)
 * Only super_admin can toggle. Sets isActive to false (suspended) or true (active).
 * Body: { secretDeclarePassword?: string } – required if admin has it set
 */
export const togglePlayerStatus = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can suspend or unsuspend player accounts',
            });
        }
        const adminWithSecret = await Admin.findById(req.admin._id).select('+secretDeclarePassword').lean();
        if (adminWithSecret?.secretDeclarePassword) {
            const provided = (req.body.secretDeclarePassword ?? '').toString().trim();
            const isValid = await bcrypt.compare(provided, adminWithSecret.secretDeclarePassword);
            if (!isValid) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid secret declare password. Please enter the correct password.',
                    code: 'INVALID_SECRET_DECLARE_PASSWORD',
                });
            }
        }
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Player not found',
            });
        }

        user.isActive = !user.isActive;
        await user.save();
        await invalidateAdminReadCaches('player_status_toggled');

        const action = user.isActive ? 'unsuspend_player' : 'suspend_player';
        await logActivity({
            action,
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'user',
            targetId: user._id.toString(),
            details: `Player "${user.username}" ${user.isActive ? 'unsuspended (account active)' : 'suspended (account blocked)'}`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: `Player ${user.isActive ? 'unsuspended' : 'suspended'} successfully`,
            data: {
                id: user._id,
                username: user.username,
                isActive: user.isActive,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete a player (Super Admin only). Removes user and their wallet.
 * Body: { secretDeclarePassword?: string } – required if admin has it set
 */
export const deletePlayer = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can delete players',
            });
        }
        const adminWithSecret = await Admin.findById(req.admin._id).select('+secretDeclarePassword').lean();
        if (adminWithSecret?.secretDeclarePassword) {
            const provided = (req.body.secretDeclarePassword ?? '').toString().trim();
            const isValid = await bcrypt.compare(provided, adminWithSecret.secretDeclarePassword);
            if (!isValid) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid secret declare password. Please enter the correct password to delete player.',
                    code: 'INVALID_SECRET_DECLARE_PASSWORD',
                });
            }
        }
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Player not found',
            });
        }

        const username = user.username;

        await Wallet.deleteOne({ userId: user._id });
        await User.findByIdAndDelete(user._id);
        await invalidateAdminReadCaches('player_deleted');

        await logActivity({
            action: 'delete_player',
            performedBy: req.admin?.username || 'Admin',
            performedByType: 'admin',
            targetType: 'user',
            targetId: id,
            details: `Player "${username}" deleted`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Player deleted successfully',
            data: { id },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Clear login devices list for a player (Admin only).
 */
export const clearLoginDevices = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Player not found',
            });
        }

        await User.updateOne({ _id: id }, { $set: { loginDevices: [] } });

        await logActivity({
            action: 'clear_login_devices',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'user',
            targetId: id,
            details: `Login devices cleared for player "${user.username}"`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Devices list cleared successfully',
            data: { id },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
