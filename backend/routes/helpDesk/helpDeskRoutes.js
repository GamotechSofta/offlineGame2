import express from 'express';
import { getTickets, getMyTickets, updateTicketStatus, createTicket, upload } from '../../controllers/helpDeskController.js';
import { requireSuperAdmin, verifyAdmin } from '../../middleware/adminAuth.js';
import { verifyUser } from '../../middleware/userAuth.js';

const router = express.Router();

// User routes (player JWT required)
router.post('/tickets', verifyUser, upload, createTicket);
router.get('/my-tickets', verifyUser, getMyTickets);

// Admin routes
router.get('/tickets', verifyAdmin, requireSuperAdmin, getTickets);
router.patch('/tickets/:id/status', verifyAdmin, requireSuperAdmin, updateTicketStatus);

export default router;
