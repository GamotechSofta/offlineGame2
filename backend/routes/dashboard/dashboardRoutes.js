import express from 'express';
import { getDashboardStats } from '../../controllers/dashboardController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.get('/stats', verifyAdmin, getDashboardStats);

export default router;
