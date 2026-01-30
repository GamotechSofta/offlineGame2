import express from 'express';
import { createUser } from '../../controllers/userController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.post('/create', verifyAdmin, createUser);

export default router;
