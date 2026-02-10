import express from 'express';
import { getReport, getRevenueReport, getBookieRevenueDetail } from '../../controllers/reportController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.get('/', verifyAdmin, getReport);
router.get('/revenue', verifyAdmin, getRevenueReport);
router.get('/revenue/:bookieId', verifyAdmin, getBookieRevenueDetail);

export default router;
