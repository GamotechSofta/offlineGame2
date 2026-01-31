import express from 'express';
import { getPayments, updatePaymentStatus } from '../../controllers/paymentController.js';
import { verifyAdmin, verifySuperAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.get('/', verifyAdmin, getPayments);
router.patch('/:id/status', verifySuperAdmin, updatePaymentStatus);

export default router;
