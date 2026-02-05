import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    getPaymentConfig,
    createDepositRequest,
    createWithdrawalRequest,
    getMyDeposits,
    getMyWithdrawals,
    getPayments,
    getPendingCount,
    approvePayment,
    rejectPayment,
    updatePaymentStatus,
} from '../../controllers/paymentController.js';
import { verifyAdmin, verifySuperAdmin } from '../../middleware/adminAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for screenshot uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../uploads/payments'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

// ===== Public APIs =====
router.get('/config', getPaymentConfig);

// ===== User APIs (no admin auth, just userId in body/query) =====
router.post('/deposit', upload.single('screenshot'), createDepositRequest);
router.post('/withdraw', createWithdrawalRequest);
router.get('/my-deposits', getMyDeposits);
router.get('/my-withdrawals', getMyWithdrawals);

// ===== Admin APIs =====
router.get('/', verifyAdmin, getPayments);
router.get('/pending-count', verifyAdmin, getPendingCount);
router.post('/:id/approve', verifyAdmin, approvePayment);
router.post('/:id/reject', verifyAdmin, rejectPayment);
router.patch('/:id/status', verifySuperAdmin, updatePaymentStatus);

export default router;
