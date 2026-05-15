import express from 'express';
import { getTickets, getMyTickets, updateTicketStatus, createTicket, upload } from '../../controllers/helpDeskController.js';
import { requireAdminTab, verifyAdmin } from '../../middleware/adminAuth.js';
import { verifyUser } from '../../middleware/userAuth.js';

const router = express.Router();

// User routes (player JWT required)
router.post('/tickets', verifyUser, upload, createTicket);
router.get('/my-tickets', verifyUser, getMyTickets);

// Admin routes
router.get('/tickets', verifyAdmin, requireAdminTab('/help-desk'), getTickets);
router.patch('/tickets/:id/status', verifyAdmin, requireAdminTab('/help-desk'), updateTicketStatus);

export default router;
