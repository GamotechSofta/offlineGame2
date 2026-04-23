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
  getLottery2DCurrentSlotHints,
    getLottery2DSlotDetail,
    getLottery2DSlotHistory,
    getLottery2DSlotPlayers,
    getLottery2DPlayerHistory,
    getLottery2DQuizStakeByNumber,
    updateLottery2DSlotResult,
} from '../../controllers/lottery2dAdminController.js';
import {
    getLottery3DCurrentSlot,
    getLottery3DCurrentSlotHints,
    getLottery3DSlotDetail,
    getLottery3DSlotPlayers,
    getLottery3DSlotHistory,
    getLottery3DPlayerHistory,
    updateLottery3DSlotResult,
} from '../../controllers/lottery3dAdminController.js';
import {
  getAdminQuizTimingSettings,
  updateAdminQuizTimingSettings,
} from '../../controllers/quizTimingAdminController.js';
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
router.post('/lottery2d/current-slot/hints', verifyAdmin, getLottery2DCurrentSlotHints);
router.get('/lottery2d/slots', verifyAdmin, getLottery2DSlotHistory);
router.get('/lottery2d/slots/:slotStartIso/detail', verifyAdmin, getLottery2DSlotDetail);
router.get('/lottery2d/quizzes/:quizId/stake-by-number', verifyAdmin, getLottery2DQuizStakeByNumber);
router.get('/lottery2d/slots/:slotStartIso/players', verifyAdmin, getLottery2DSlotPlayers);
router.get('/lottery2d/players/:userId/history', verifyAdmin, getLottery2DPlayerHistory);
router.patch('/lottery2d/slots/:slotStartIso/result', verifyAdmin, updateLottery2DSlotResult);

// 3D lottery admin management
router.get('/lottery3d/current-slot', verifyAdmin, getLottery3DCurrentSlot);
router.post('/lottery3d/current-slot/hints', verifyAdmin, getLottery3DCurrentSlotHints);
router.get('/lottery3d/slots', verifyAdmin, getLottery3DSlotHistory);
router.get('/lottery3d/slots/:slotStartIso/detail', verifyAdmin, getLottery3DSlotDetail);
router.get('/lottery3d/slots/:slotStartIso/players', verifyAdmin, getLottery3DSlotPlayers);
router.get('/lottery3d/players/:userId/history', verifyAdmin, getLottery3DPlayerHistory);
router.patch('/lottery3d/slots/:slotStartIso/result', verifyAdmin, updateLottery3DSlotResult);

// Quiz timing settings (study/hint split + reveal stagger)
router.get('/quiz-settings/:mode', verifyAdmin, getAdminQuizTimingSettings);
router.patch('/quiz-settings/:mode', verifyAdmin, updateAdminQuizTimingSettings);

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
