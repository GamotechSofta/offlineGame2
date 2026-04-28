import express from 'express';
import {
    getPublicBannerSettings,
    getAdminBannerSettings,
    updateAdminBannerSettings,
    uploadBannerImages,
} from '../../controllers/bannerController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.get('/', getPublicBannerSettings);
router.get('/admin', verifyAdmin, getAdminBannerSettings);
router.patch('/admin', verifyAdmin, uploadBannerImages, updateAdminBannerSettings);

export default router;
