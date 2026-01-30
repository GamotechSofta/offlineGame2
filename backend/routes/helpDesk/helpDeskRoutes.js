import express from 'express';
import { getTickets, updateTicketStatus, createTicket, upload } from '../../controllers/helpDeskController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// Public route for users to create tickets
router.post('/tickets', upload, createTicket);

// Admin routes
router.get('/tickets', verifyAdmin, getTickets);
router.patch('/tickets/:id/status', verifyAdmin, updateTicketStatus);

export default router;
