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
    getLottery2DAggregateStats,
    getLottery2DCurrentSlotHints,
    getLottery2DSlotDetail,
    getLottery2DSlotHistory,
    getLottery2DDaySlotSchedule,
    getLottery2DDayPlayers,
    getLottery2DSlotPlayers,
    getLottery2DTickets,
    getLottery2DTicketBets,
    getLottery2DPlayerHistory,
    getLottery2DQuizStakeByNumber,
    getLottery2DDeclarationMatrix,
    updateLottery2DSlotResult,
    updateLottery2DSlotDeclaration,
} from '../../controllers/lottery2dAdminController.js';
import {
    getLottery3DCurrentSlot,
    getLottery3DCurrentSlotHints,
    getLottery3DSlotDetail,
    getLottery3DSlotPlayers,
    getLottery3DSlotWiseBets,
    getLottery3DSlotHistory,
    getLottery3DDaySlotSchedule,
    getLottery3DDayPlayers,
    getLottery3DPlayerHistory,
    getLottery3DQuizStakeByNumber,
    getLottery3DTickets,
    getLottery3DTicketBets,
    updateLottery3DSlotResult,
    updateLottery3DSlotDeclaration,
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
router.get('/lottery2d/aggregate-stats', verifyAdmin, getLottery2DAggregateStats);
router.post('/lottery2d/current-slot/hints', verifyAdmin, getLottery2DCurrentSlotHints);
router.get('/lottery2d/slots', verifyAdmin, getLottery2DSlotHistory);
router.get('/lottery2d/day-slot-schedule', verifyAdmin, getLottery2DDaySlotSchedule);
router.get('/lottery2d/day-players', verifyAdmin, getLottery2DDayPlayers);
router.get('/lottery2d/slots/:slotStartIso/detail', verifyAdmin, getLottery2DSlotDetail);
router.get('/lottery2d/quizzes/:quizId/stake-by-number', verifyAdmin, getLottery2DQuizStakeByNumber);
router.get('/lottery2d/slots/:slotStartIso/players', verifyAdmin, getLottery2DSlotPlayers);
router.get('/lottery2d/tickets', verifyAdmin, getLottery2DTickets);
router.get('/lottery2d/tickets/:ticketId/bets', verifyAdmin, getLottery2DTicketBets);
router.get('/lottery2d/players/:userId/history', verifyAdmin, getLottery2DPlayerHistory);
router.get('/lottery2d/slots/declaration-matrix', verifyAdmin, getLottery2DDeclarationMatrix);
router.patch('/lottery2d/slots/:slotStartIso/result', verifyAdmin, updateLottery2DSlotResult);
router.patch('/lottery2d/slots/declaration', verifyAdmin, updateLottery2DSlotDeclaration);

// 3D lottery admin management
router.get('/lottery3d/current-slot', verifyAdmin, getLottery3DCurrentSlot);
router.post('/lottery3d/current-slot/hints', verifyAdmin, getLottery3DCurrentSlotHints);
router.get('/lottery3d/slots', verifyAdmin, getLottery3DSlotHistory);
router.get('/lottery3d/day-slot-schedule', verifyAdmin, getLottery3DDaySlotSchedule);
router.get('/lottery3d/day-players', verifyAdmin, getLottery3DDayPlayers);
router.get('/lottery3d/slots/:slotStartIso/detail', verifyAdmin, getLottery3DSlotDetail);
router.get('/lottery3d/quizzes/:quizId/stake-by-number', verifyAdmin, getLottery3DQuizStakeByNumber);
router.get('/lottery3d/slots/:slotStartIso/players', verifyAdmin, getLottery3DSlotPlayers);
router.get('/lottery3d/slot-wise-bets', verifyAdmin, getLottery3DSlotWiseBets);
router.get('/lottery3d/tickets', verifyAdmin, getLottery3DTickets);
router.get('/lottery3d/tickets/:ticketId/bets', verifyAdmin, getLottery3DTicketBets);
router.get('/lottery3d/players/:userId/history', verifyAdmin, getLottery3DPlayerHistory);
router.patch('/lottery3d/slots/:slotStartIso/result', verifyAdmin, updateLottery3DSlotResult);
router.patch('/lottery3d/slots/declaration', verifyAdmin, updateLottery3DSlotDeclaration);

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
