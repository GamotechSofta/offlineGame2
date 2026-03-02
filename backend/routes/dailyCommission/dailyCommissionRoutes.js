import express from 'express';
import { 
    calculateDailyCommission, 
    getDailyCommissions, 
    getAllDailyCommissions 
} from '../../controllers/dailyCommissionController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// Calculate daily commission for all bookies (super admin only, or can be automated)
router.post('/calculate', verifyAdmin, calculateDailyCommission);

// Get daily commissions for current bookie
router.get('/', verifyAdmin, getDailyCommissions);

// Get all daily commissions (super admin only)
router.get('/all', verifyAdmin, getAllDailyCommissions);

export default router;
