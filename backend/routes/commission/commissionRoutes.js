import express from 'express';
import {
    createCommissionRequest,
    getMyCommissionRequests,
    acceptCounterOffer,
    rejectCounterOffer,
    getAllCommissionRequests,
    approveCommissionRequest,
    rejectCommissionRequest,
    negotiateCommissionRequest,
} from '../../controllers/commissionController.js';
import { verifyAdmin, verifySuperAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// Bookie routes
router.post('/request', verifyAdmin, createCommissionRequest);
router.get('/my-requests', verifyAdmin, getMyCommissionRequests);
router.post('/accept-counter/:requestId', verifyAdmin, acceptCounterOffer);
router.post('/reject-counter/:requestId', verifyAdmin, rejectCounterOffer);

// Super Admin routes
router.get('/all', verifySuperAdmin, getAllCommissionRequests);
router.post('/approve/:requestId', verifySuperAdmin, approveCommissionRequest);
router.post('/reject/:requestId', verifySuperAdmin, rejectCommissionRequest);
router.post('/negotiate/:requestId', verifySuperAdmin, negotiateCommissionRequest);

export default router;
