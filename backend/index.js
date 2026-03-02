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
import rateRoutes from './routes/rate/rateRoutes.js';
import dailyCommissionRoutes from './routes/dailyCommission/dailyCommissionRoutes.js';

import bankDetailRoutes from './routes/bankDetail/bankDetailRoutes.js';
import { getClientIp } from './utils/activityLogger.js';
import { startMidnightResetScheduler } from './utils/midnightReset.js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3010;

connectDB();

app.set('trust proxy', 1);

app.use(helmet());

// CORS configuration
const isProduction = process.env.NODE_ENV === 'production';
const allowedOriginsRaw = process.env.ALLOWED_ORIGINS;
if (isProduction && (!allowedOriginsRaw || !allowedOriginsRaw.trim())) {
    throw new Error(
        'ALLOWED_ORIGINS must be set in production. Set it to your frontend origin(s), e.g. ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com'
    );
}
const allowedOrigins = allowedOriginsRaw
    ? allowedOriginsRaw.split(',').map(origin => origin.trim()).filter(Boolean)
    : ['*']; // Default: allow all (development only)

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Try again later.' },
});
app.use('/api/v1', (req, res, next) => {
    if (req.method === 'POST' && /\/users\/login$/.test(req.originalUrl)) return loginLimiter(req, res, next);
    next();
});
app.use('/api/v1', apiLimiter);

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
app.use('/api/v1/rates', rateRoutes);
app.use('/api/v1/daily-commission', dailyCommissionRoutes);

app.use('/api/v1/bank-details', bankDetailRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // Start the midnight reset scheduler
    startMidnightResetScheduler();
});
