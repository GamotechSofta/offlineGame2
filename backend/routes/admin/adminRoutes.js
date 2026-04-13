import express from 'express';
import { 
    adminLogin, 
    createAdmin, 
    createBookie,
    getAllBookies,
    getAllSuperAdmins,
    getBookieById,
    updateBookie,
    deleteBookie,
    toggleBookieStatus,
    getSecretDeclarePasswordStatus,
    setSecretDeclarePassword,
    getSpCommonList,
    getDpCommonList,
} from '../../controllers/adminController.js';
import { getLogs } from '../../controllers/activityLogController.js';
import {
    getLottery2DCurrentSlot,
    getLottery2DSlotDetail,
    getLottery2DSlotHistory,
    updateLottery2DSlotResult,
} from '../../controllers/lottery2dAdminController.js';
import { verifyAdmin, verifySuperAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.post('/login', adminLogin);
router.post('/create', createAdmin); // For initial admin setup

// Secret declare password (Super Admin only)
router.get('/me/secret-declare-password-status', verifySuperAdmin, getSecretDeclarePasswordStatus);
router.patch('/me/secret-declare-password', verifySuperAdmin, setSecretDeclarePassword);

// SP Common list (SP Common game chart / reference)
router.get('/config/sp-common-list', verifyAdmin, getSpCommonList);
// DP Common list (DP Common game chart / reference)
router.get('/config/dp-common-list', verifyAdmin, getDpCommonList);

// 2D lottery admin management
router.get('/lottery2d/current-slot', verifyAdmin, getLottery2DCurrentSlot);
router.get('/lottery2d/slots', verifyAdmin, getLottery2DSlotHistory);
router.get('/lottery2d/slots/:slotStartIso/detail', verifyAdmin, getLottery2DSlotDetail);
router.patch('/lottery2d/slots/:slotStartIso/result', verifyAdmin, updateLottery2DSlotResult);

// Super Admin management routes (Super Admin only)
router.get('/super-admins', verifyAdmin, getAllSuperAdmins); // Get all super admins
router.get('/logs', verifyAdmin, getLogs); // Get activity logs

// Bookie management routes (Super Admin only)
router.post('/bookies', verifyAdmin, createBookie); // Create new bookie
router.get('/bookies', verifyAdmin, getAllBookies); // Get all bookies
router.get('/bookies/:id', verifyAdmin, getBookieById); // Get single bookie
router.put('/bookies/:id', verifyAdmin, updateBookie); // Update bookie
router.delete('/bookies/:id', verifyAdmin, deleteBookie); // Delete bookie
router.patch('/bookies/:id/toggle-status', verifyAdmin, toggleBookieStatus); // Toggle status

// Keep old route for backward compatibility
router.post('/create-bookie', verifyAdmin, createBookie);

export default router;
