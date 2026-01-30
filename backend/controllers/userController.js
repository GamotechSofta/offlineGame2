import User from '../models/user/user.js';
import bcrypt from 'bcryptjs';
import { Wallet } from '../models/wallet/wallet.js';

export const userLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        const user = await User.findOne({ username, isActive: true });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

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

        // Create user
        const userDoc = {
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone: phone || '',
            role: 'user',
            balance: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const user = await User.collection.insertOne(userDoc);
        const userId = user.insertedId;

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
        const { username, email, password, phone, role, balance } = req.body;
        
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
