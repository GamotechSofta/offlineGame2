import axios from 'axios';
import { body, validationResult } from 'express-validator';

// Where this server forwards validated payloads (same URL your deposit flow uses).
const EXTERNAL_WEBHOOK_URL =
    process.env.SCREENSHOT_WEBHOOK_URL || 'https://api.thefashionista.in/api/v1/webhook/screenshot-uploaded';

/** Headers expected by external webhook (aligned with paymentController notifyScreenshotWebhook). */
const buildOutboundWebhookHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
        headers['x-webhook-secret'] = secret;
        headers['webhook-secret'] = secret;
        headers.Authorization = `Bearer ${secret}`;
    }
    return headers;
};

// express-validator rules for incoming webhook payload.
export const validateScreenshotUploadedWebhook = [
    body('refId')
        .isString()
        .withMessage('refId is required and must be a string')
        .trim()
        .notEmpty()
        .withMessage('refId is required'),
    body('screenshotUrl')
        .isString()
        .withMessage('screenshotUrl is required and must be a string')
        .trim()
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('screenshotUrl must be a valid URL'),
    // JSON bodies often send amount as a number; isFloat() only accepts strings — use custom.
    body('amount')
        .custom((value) => {
            const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').trim());
            return Number.isFinite(n) && n > 0;
        })
        .withMessage('amount is required and must be a valid positive number'),
    body('utr')
        .isString()
        .withMessage('utr is required and must be a string')
        .trim()
        .isLength({ min: 12, max: 12 })
        .withMessage('utr must be exactly 12 characters'),
];

/**
 * POST /api/v1/webhook/screenshot-uploaded
 * Validates incoming payload and forwards it to external webhook URL.
 */
export const handleScreenshotUploadedWebhook = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: errors.array()[0]?.msg || 'Invalid webhook payload',
        });
    }

    const payload = {
        refId: req.body.refId,
        screenshotUrl: req.body.screenshotUrl,
        amount: Number(req.body.amount),
        utr: req.body.utr,
    };

    try {
        console.log('📥 Webhook received:', JSON.stringify(payload));

        const response = await axios.post(EXTERNAL_WEBHOOK_URL, payload, {
            timeout: Number(process.env.WEBHOOK_FORWARD_TIMEOUT_MS || 8000),
            headers: buildOutboundWebhookHeaders(),
        });

        console.log('✅ Webhook forwarded successfully:', JSON.stringify({
            refId: payload.refId,
            externalStatus: response.status,
        }));

        return res.status(200).json({
            success: true,
            message: 'Webhook forwarded successfully',
            data: response.data,
        });
    } catch (error) {
        const data = error.response?.data;
        const externalMessage =
            (data && typeof data === 'object' && data.message) ||
            (typeof data === 'string' ? data : null) ||
            error.message;

        let details = null;
        if (data !== undefined && data !== null) {
            details = typeof data === 'object' ? data : String(data);
        }

        console.error('❌ Failed to forward webhook:', JSON.stringify({
            refId: payload.refId,
            status: error.response?.status || null,
            message: externalMessage,
            code: error.code || null,
        }));

        return res.status(502).json({
            success: false,
            message: externalMessage || 'Failed to forward webhook',
            ...(details ? { details } : {}),
        });
    }
};
