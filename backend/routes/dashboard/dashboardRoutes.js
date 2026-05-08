import express from 'express';
import { getDashboardStats, getDashboardSummary, getDashboardPerfMetrics } from '../../controllers/dashboardController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.get('/stats', verifyAdmin, getDashboardStats);
router.get('/summary', verifyAdmin, getDashboardSummary);
router.get('/perf', verifyAdmin, getDashboardPerfMetrics);

export default router;
