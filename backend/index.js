import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db_Connection.js';
import marketRoutes from './routes/market/marketRoutes.js';
import adminRoutes from './routes/admin/adminRoutes.js';
import bookieRoutes from './routes/bookie/bookieRoutes.js';
import userRoutes from './routes/user/userRoutes.js';
import betRoutes from './routes/bet/betRoutes.js';
import paymentRoutes from './routes/payment/paymentRoutes.js';
import walletRoutes from './routes/wallet/walletRoutes.js';
import reportRoutes from './routes/report/reportRoutes.js';
import helpDeskRoutes from './routes/helpDesk/helpDeskRoutes.js';
import dashboardRoutes from './routes/dashboard/dashboardRoutes.js';
import { getClientIp } from './utils/activityLogger.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3010;

connectDB();

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Temporary: verify real client IP behind Render proxy
app.get('/test-ip', (req, res) => {
    res.json({
        'req.ip': req.ip ?? null,
        'req.headers[\'x-forwarded-for\']': req.headers['x-forwarded-for'] ?? null,
        getClientIp: getClientIp(req),
    });
});

app.use('/api/v1/markets', marketRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/bookie', bookieRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/bets', betRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/help-desk', helpDeskRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
