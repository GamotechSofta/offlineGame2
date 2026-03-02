import express from 'express';
import { getReport, getRevenueReport, getBookieRevenueDetail, getCustomerBalanceOverview } from '../../controllers/reportController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.get('/', verifyAdmin, getReport);
router.get('/revenue', verifyAdmin, getRevenueReport);
router.get('/customer-balance', verifyAdmin, getCustomerBalanceOverview);
router.get('/revenue/:bookieId', verifyAdmin, getBookieRevenueDetail);

export default router;
