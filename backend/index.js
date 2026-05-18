import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import connectDB from './config/db_Connection.js';
import adminRoutes from './routes/admin/adminRoutes.js';
import betRoutes from './routes/bet/betRoutes.js';
import bookieRoutes from './routes/bookie/bookieRoutes.js';
import superBookieRoutes from './routes/superBookie/superBookieRoutes.js';
import dailyCommissionRoutes from './routes/dailyCommission/dailyCommissionRoutes.js';
import commissionRoutes from './routes/commission/commissionRoutes.js';
import dashboardRoutes from './routes/dashboard/dashboardRoutes.js';
import genericRouter from './routes/generics/genericRouter.js';
import helpDeskRoutes from './routes/helpDesk/helpDeskRoutes.js';
import marketRoutes from './routes/market/marketRoutes.js';
import paymentRoutes from './routes/payment/paymentRoutes.js';
import rateRoutes from './routes/rate/rateRoutes.js';
import reportRoutes from './routes/report/reportRoutes.js';
import userRoutes from './routes/user/userRoutes.js';
import walletRoutes from './routes/wallet/walletRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import bannerRoutes from './routes/banner/bannerRoutes.js';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import bankDetailRoutes from './routes/bankDetail/bankDetailRoutes.js';
import gamesRouter from './routes/games/gamesRoutes.js';
import quizRoutes from './routes/quiz/quizRoutes.js';
import { startQuizSlotPickScheduler } from './services/slotScheduler.js';
import { initQuizSocket } from './socket/socketHub.js';
import { emitAdminDashboardUpdate, emitAdminMarketUpdate } from './socket/socketHub.js';
import { getClientIp } from './utils/activityLogger.js';
import { startMidnightResetScheduler } from './utils/midnightReset.js';
import { startAdminRealtimeMonitor } from './services/adminRealtimeService.js';
import { createRuntimeRequestTracker, startRuntimeMonitoring } from './services/runtimeMonitorService.js';
import { apiPerfLogger } from './middleware/perfLogger.js';
import { installMongoTracing } from './services/mongoTraceService.js';

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
        'D:/bulk-load-tester-fixed.html'
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
app.use(compression());
app.use(createRuntimeRequestTracker());
app.use(apiPerfLogger);
// Large 3D batch buys can send very big payloads (thousands of bet lines).
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Inbound webhook relay (mounted early so partner webhooks are reachable)
app.use('/api/v1', webhookRoutes);

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
app.use('/api/v1/super-bookie', superBookieRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/bets', betRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/help-desk', helpDeskRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/rates', rateRoutes);
app.use('/api/v1/daily-commission', dailyCommissionRoutes);
app.use('/api/v1/commission', commissionRoutes);
app.use('/api/v1/games', gamesRouter);

app.use('/api/v1/bank-details', bankDetailRoutes);
app.use('/api/v1/quiz', quizRoutes);
app.use('/api/v1/generics', genericRouter);
app.use('/api/v1/banner-settings', bannerRoutes);

async function startServer() {
    await connectDB();
    installMongoTracing();
    const httpServer = http.createServer(app);
    initQuizSocket(httpServer, { allowedOrigins, isProduction });
    httpServer.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        startRuntimeMonitoring();
        startMidnightResetScheduler();
        startQuizSlotPickScheduler();
        startAdminRealtimeMonitor((snapshot) => {
            emitAdminDashboardUpdate(snapshot);
            emitAdminMarketUpdate(snapshot);
        });
    });
}

startServer().catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});
