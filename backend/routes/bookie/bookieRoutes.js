import express from 'express';
import { bookieLogin } from '../../controllers/bookieController.js';

const router = express.Router();

router.post('/login', bookieLogin);

export default router;
