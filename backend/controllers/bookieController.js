import Admin from '../models/admin/admin.js';

/**
 * Bookie login - only allows users with role 'bookie'
 * Body: { username, password }
 */
export const bookieLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        const bookie = await Admin.findOne({ username, role: 'bookie' });
        if (!bookie) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        const isPasswordValid = await bookie.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                id: bookie._id,
                username: bookie.username,
                role: bookie.role,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
