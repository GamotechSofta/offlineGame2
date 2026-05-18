import express from 'express';
import {
    createCommissionRequest,
    getMyCommissionRequests,
    acceptCounterOffer,
    rejectCounterOffer,
    getAllCommissionRequests,
    getSuperBookieCommissionRequests,
    approveCommissionRequest,
    approveSuperBookieCommissionRequest,
    rejectCommissionRequest,
    rejectSuperBookieCommissionRequest,
    negotiateCommissionRequest,
    negotiateSuperBookieCommissionRequest,
} from '../../controllers/commissionController.js';
import { verifyAdmin, verifySuperAdmin, requireAdminTab, requireBookie } from '../../middleware/adminAuth.js';

const router = express.Router();

// Bookie / Super Bookie
router.post('/request', verifyAdmin, createCommissionRequest);
router.get('/my-requests', verifyAdmin, getMyCommissionRequests);
router.post('/accept-counter/:requestId', verifyAdmin, acceptCounterOffer);
router.post('/reject-counter/:requestId', verifyAdmin, rejectCounterOffer);

// Parent bookie: super bookie requests
router.get('/super-bookie-requests', verifyAdmin, requireBookie, getSuperBookieCommissionRequests);
router.post('/super-bookie-approve/:requestId', verifyAdmin, requireBookie, approveSuperBookieCommissionRequest);
router.post('/super-bookie-reject/:requestId', verifyAdmin, requireBookie, rejectSuperBookieCommissionRequest);
router.post('/super-bookie-negotiate/:requestId', verifyAdmin, requireBookie, negotiateSuperBookieCommissionRequest);

// Super Admin: bookie requests
router.get('/all', verifyAdmin, requireAdminTab('/bookie-commissions'), getAllCommissionRequests);
router.post('/approve/:requestId', verifySuperAdmin, approveCommissionRequest);
router.post('/reject/:requestId', verifySuperAdmin, rejectCommissionRequest);
router.post('/negotiate/:requestId', verifySuperAdmin, negotiateCommissionRequest);

export default router;
