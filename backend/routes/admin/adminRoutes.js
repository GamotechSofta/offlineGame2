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
} from '../../controllers/adminController.js';
import { getLogs } from '../../controllers/activityLogController.js';
import { verifyAdmin, verifySuperAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.post('/login', adminLogin);
router.post('/create', createAdmin); // For initial admin setup

// Secret declare password (Super Admin only)
router.get('/me/secret-declare-password-status', verifySuperAdmin, getSecretDeclarePasswordStatus);
router.patch('/me/secret-declare-password', verifySuperAdmin, setSecretDeclarePassword);

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
