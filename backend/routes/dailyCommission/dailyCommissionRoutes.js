import express from 'express';
import {
    calculateDailyCommission,
    getDailyCommissions,
    getAllDailyCommissions,
    getAllCommissionSummary,
    recordCommissionPayment,
    recordBookieCommissionPayment,
    getBookieCommissionPaymentHistory,
    getMyCommissionPayments,
    getMyCommissionSummary,
    getAdminPlatformCommissionSummary,
    getSuperBookieCommissionSummary,
    recordSuperBookieCommissionPayment,
    settleSuperBookieCommissionFromBets,
    getSuperBookieCommissionPaymentHistory,
} from '../../controllers/dailyCommissionController.js';
import { verifyAdmin, requireBookie } from '../../middleware/adminAuth.js';

const router = express.Router();

router.post('/calculate', verifyAdmin, calculateDailyCommission);
router.get('/my-payments', verifyAdmin, getMyCommissionPayments);
router.get('/my-summary', verifyAdmin, getMyCommissionSummary);
router.get('/admin-platform-summary', verifyAdmin, getAdminPlatformCommissionSummary);
router.get('/super-bookie-summary', verifyAdmin, requireBookie, getSuperBookieCommissionSummary);
router.post('/super-bookie/:superBookieId/pay', verifyAdmin, requireBookie, recordSuperBookieCommissionPayment);
router.post('/super-bookie/:superBookieId/settle-bets', verifyAdmin, requireBookie, settleSuperBookieCommissionFromBets);
router.get('/super-bookie/:superBookieId/payments', verifyAdmin, requireBookie, getSuperBookieCommissionPaymentHistory);
router.get('/', verifyAdmin, getDailyCommissions);
router.get('/all', verifyAdmin, getAllDailyCommissions);
router.get('/all-summary', verifyAdmin, getAllCommissionSummary);
router.post('/:commissionId/pay', verifyAdmin, recordCommissionPayment);
router.post('/bookie/:bookieId/pay', verifyAdmin, recordBookieCommissionPayment);
router.get('/bookie/:bookieId/payments', verifyAdmin, getBookieCommissionPaymentHistory);

export default router;
