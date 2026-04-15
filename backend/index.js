import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import connectDB from './config/db_Connection.js';
import marketRoutes from './routes/market/marketRoutes.js';
import adminRoutes from './routes/admin/adminRoutes.js';
import bookieRoutes from './routes/bookie/bookieRoutes.js';
import userRoutes from './routes/user/userRoutes.js';
import betRoutes from './routes/bet/betRoutes.js';
import paymentRoutes from './routes/payment/paymentRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import walletRoutes from './routes/wallet/walletRoutes.js';
import reportRoutes from './routes/report/reportRoutes.js';
import helpDeskRoutes from './routes/helpDesk/helpDeskRoutes.js';
import dashboardRoutes from './routes/dashboard/dashboardRoutes.js';
import rateRoutes from './routes/rate/rateRoutes.js';
import dailyCommissionRoutes from './routes/dailyCommission/dailyCommissionRoutes.js';
import genericRouter from './routes/generics/genericRouter.js';

import bankDetailRoutes from './routes/bankDetail/bankDetailRoutes.js';
import quizRoutes from './routes/quiz/quizRoutes.js';
import { syncQuizSeedsOnStartup } from './services/seedService.js';
import { getClientIp } from './utils/activityLogger.js';
import { startMidnightResetScheduler } from './utils/midnightReset.js';
import { startQuizSlotPickScheduler } from './services/slotScheduler.js';
import { initQuizSocket } from './socket/socketHub.js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
const app = express();
const PORT = process.env.PORT || 3010;
const SCREENSHOT_WEBHOOK_URL =
    process.env.SCREENSHOT_WEBHOOK_URL || 'https://api.thefashionista.in/api/v1/webhook/screenshot-uploaded';
process.env.SCREENSHOT_WEBHOOK_URL = SCREENSHOT_WEBHOOK_URL;

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
const localhostOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        const isLocalhostOrigin = !!origin && localhostOriginRegex.test(origin);
        const isExplicitlyAllowed = !!origin && allowedOrigins.includes(origin);
        const allowAll = allowedOrigins.includes('*');
        // In local development, always allow localhost/127.0.0.1 origins.
        const allowLocalDev = !isProduction && isLocalhostOrigin;

        if (!origin || allowAll || isExplicitlyAllowed || allowLocalDev) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret', 'webhook-secret'],
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    },
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const retryAfterMs = req.rateLimit?.resetTime
            ? Math.max(0, new Date(req.rateLimit.resetTime).getTime() - Date.now())
            : 15 * 60 * 1000;
        const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterMs / (60 * 1000)));
        return res.status(429).json({
            success: false,
            message: `Too many login attempts. Try again after ${retryAfterMinutes} minute(s).`,
            code: 'LOGIN_RATE_LIMITED',
            retryAfterMinutes,
        });
    },
});
app.use('/api/v1', (req, res, next) => {
    if (
        req.method === 'POST' &&
        /\/(users|admin|bookie)\/login$/.test(req.originalUrl)
    ) {
        return loginLimiter(req, res, next);
    }
    next();
});

// Inbound webhook relay — mounted before global /api/v1 rate limit (partner retries / bursts)
app.use('/api/v1', webhookRoutes);

app.use('/api/v1', apiLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve downloadable files (APK, etc.) – works in production with path.join
app.use('/downloads', express.static(path.join(__dirname, 'public')));

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
app.use('/api/v1/quiz', quizRoutes);
app.use('/api/v1/generics', genericRouter);

async function startServer() {
    await connectDB();
    await syncQuizSeedsOnStartup();
    const httpServer = http.createServer(app);
    initQuizSocket(httpServer, { allowedOrigins, isProduction });
    httpServer.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        startMidnightResetScheduler();
        startQuizSlotPickScheduler();
    });
}

startServer().catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});
