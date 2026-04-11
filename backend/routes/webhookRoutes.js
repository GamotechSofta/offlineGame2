import express from 'express';
import {
    handleScreenshotUploadedWebhook,
    validateScreenshotUploadedWebhook,
} from '../controllers/webhookController.js';

const router = express.Router();

// Spread validator array — Express needs each rule as its own middleware
router.post(
    '/webhook/screenshot-uploaded',
    ...validateScreenshotUploadedWebhook,
    handleScreenshotUploadedWebhook
);

export default router;
