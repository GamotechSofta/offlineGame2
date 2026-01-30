import express from 'express';
import { getReport } from '../../controllers/reportController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.get('/', verifyAdmin, getReport);

export default router;
