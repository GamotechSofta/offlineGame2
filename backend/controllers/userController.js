import User from '../models/user/user.js';
import bcrypt from 'bcryptjs';
import { Wallet } from '../models/wallet/wallet.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

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
        const { username, password, deviceId } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        const user = await User.findOne({ username });
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
        const trimmedDeviceId = deviceId && typeof deviceId === 'string' ? deviceId.trim() : '';
        const update = {
            lastActiveAt: new Date(),
            lastLoginIp: clientIp || undefined,
            ...(trimmedDeviceId ? { lastLoginDeviceId: trimmedDeviceId } : {}),
        };
        await User.updateOne({ _id: user._id }, { $set: update });

        if (trimmedDeviceId) {
            const doc = await User.findById(user._id).select('loginDevices').lean();
            const loginDevices = Array.isArray(doc?.loginDevices) ? [...doc.loginDevices] : [];
            const now = new Date();
            const idx = loginDevices.findIndex((d) => String(d.deviceId) === trimmedDeviceId);
            if (idx >= 0) {
                loginDevices[idx].lastLoginAt = now;
            } else {
                loginDevices.push({ deviceId: trimmedDeviceId, firstLoginAt: now, lastLoginAt: now });
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

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                balance: balance,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const userHeartbeat = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
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

export const userSignup = async (req, res) => {
    try {
        const { username, email, password, phone } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username, email and password are required',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email: email.toLowerCase() }]
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Username or email already exists',
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Direct frontend signup: referredBy = null → super_admin's user. Via bookie link: referredBy = bookie ID → bookie's user.
        const referredBy = req.body.referredBy || null;
        const source = referredBy ? 'bookie' : 'super_admin';
        const now = new Date();
        const userDoc = {
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone: phone || '',
            role: 'user',
            balance: 0,
            isActive: true,
            source,
            referredBy,
            lastActiveAt: now,
            createdAt: now,
            updatedAt: now,
        };

        const user = await User.collection.insertOne(userDoc);
        const userId = user.insertedId;

        await logActivity({
            action: 'player_signup',
            performedBy: username,
            performedByType: 'user',
            targetType: 'user',
            targetId: userId.toString(),
            details: `Player "${username}" signed up (${source === 'bookie' ? 'via bookie link' : 'direct frontend'})`,
            meta: { email: userDoc.email, source },
            ip: getClientIp(req),
        });

        // Create wallet for user
        await Wallet.collection.insertOne({
            userId,
            balance: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                id: userId,
                username: userDoc.username,
                email: userDoc.email,
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

export const createUser = async (req, res) => {
    try {
        const { username, email, password, phone, role, balance, referredBy } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username, email and password are required',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        // Super admin creates → source=super_admin, referredBy=null. Bookie creates → source=bookie, referredBy=bookie_id.
        let finalReferredBy = referredBy;
        let source = 'super_admin';
        if (req.admin && req.admin.role === 'bookie') {
            finalReferredBy = req.admin._id;
            source = 'bookie';
        }

        // Hash password manually to avoid pre-save hook issues
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user directly in collection to bypass pre-save hook
        const userDoc = {
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone: phone || '',
            role: role || 'user',
            balance: balance || 0,
            isActive: true,
            source,
            referredBy: finalReferredBy || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const user = await User.collection.insertOne(userDoc);
        const userId = user.insertedId;

        // Create wallet for user
        await Wallet.collection.insertOne({
            userId,
            balance: balance || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        if (req.admin) {
            await logActivity({
                action: 'create_player',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'admin',
                targetType: 'user',
                targetId: userId.toString(),
                details: `Player "${username}" created`,
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
 * filter=super_admin: users where source=super_admin or (referredBy=null) - super admin's users only.
 * filter=bookie: users where source=bookie or (referredBy!=null) - bookie's users; sorted by bookie username then createdAt.
 */
export const getUsers = async (req, res) => {
    try {
        const { filter = 'all' } = req.query;
        const bookieUserIds = await getBookieUserIds(req.admin);
        const query = {};

        if (bookieUserIds !== null) {
            query._id = { $in: bookieUserIds };
        }

        if (filter === 'super_admin') {
            query.$or = [{ referredBy: null }, { referredBy: { $exists: false } }];
        } else if (filter === 'bookie') {
            query.referredBy = { $ne: null, $exists: true };
        }

        let users = await User.find(query)
            .select('username email phone role isActive source referredBy lastActiveAt lastLoginIp lastLoginDeviceId loginDevices createdAt')
            .populate('referredBy', 'username')
            .sort(filter === 'bookie' ? { referredBy: 1, createdAt: -1 } : { createdAt: -1 })
            .limit(500)
            .lean();

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

        res.status(200).json({ success: true, data: users });
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
            .select('username email phone role isActive source referredBy lastActiveAt lastLoginIp lastLoginDeviceId loginDevices createdAt')
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
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Toggle player account status (suspend/unsuspend)
 * Only super_admin can toggle. Sets isActive to false (suspended) or true (active).
 */
export const togglePlayerStatus = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can suspend or unsuspend player accounts',
            });
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
 */
export const deletePlayer = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can delete players',
            });
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
