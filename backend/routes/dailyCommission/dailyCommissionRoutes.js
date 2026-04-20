import express from 'express';
import { 
    calculateDailyCommission, 
    getDailyCommissions, 
    getAllDailyCommissions,
    getAllCommissionSummary,
    recordCommissionPayment,
    recordBookieCommissionPayment,
    getBookieCommissionPaymentHistory,
} from '../../controllers/dailyCommissionController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// Calculate daily commission for all bookies (super admin only, or can be automated)
router.post('/calculate', verifyAdmin, calculateDailyCommission);

// Get daily commissions for current bookie
router.get('/', verifyAdmin, getDailyCommissions);

// Get all daily commissions (super admin only)
router.get('/all', verifyAdmin, getAllDailyCommissions);
router.get('/all-summary', verifyAdmin, getAllCommissionSummary);
router.post('/:commissionId/pay', verifyAdmin, recordCommissionPayment);
router.post('/bookie/:bookieId/pay', verifyAdmin, recordBookieCommissionPayment);
router.get('/bookie/:bookieId/payments', verifyAdmin, getBookieCommissionPaymentHistory);

export default router;
