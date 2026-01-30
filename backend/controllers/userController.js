import User from '../models/user/user.js';

export const createUser = async (req, res) => {
    try {
        const { username, email, password, phone, role, balance } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username, email and password are required',
            });
        }

        const user = new User({ username, email, password, phone, role, balance });
        await user.save();

        // Create wallet for user
        const { Wallet } = await import('../models/wallet/wallet.js');
        await Wallet.create({ userId: user._id, balance: balance || 0 });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
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
