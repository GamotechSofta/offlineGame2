import express from 'express';
import multer from 'multer';
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
    getPaymentScreenshot,
} from '../../controllers/paymentController.js';
import { verifyAdmin, verifySuperAdmin } from '../../middleware/adminAuth.js';

// Configure multer with memory storage for database storage
const storage = multer.memoryStorage();

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
router.get('/my-screenshot/:id', getPaymentScreenshot); // User can view their own screenshot

// ===== Admin APIs =====
router.get('/', verifyAdmin, getPayments);
router.get('/pending-count', verifyAdmin, getPendingCount);
router.get('/:id/screenshot', verifyAdmin, getPaymentScreenshot);
router.post('/:id/approve', verifyAdmin, approvePayment);
router.post('/:id/reject', verifyAdmin, rejectPayment);
router.patch('/:id/status', verifySuperAdmin, updatePaymentStatus);

export default router;
