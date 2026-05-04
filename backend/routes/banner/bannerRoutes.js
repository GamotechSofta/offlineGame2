import express from 'express';
import {
    getPublicBannerSettings,
    getAdminBannerSettings,
    getAdminLotteryNews,
    getPublicLotteryNews,
    updateAdminBannerSettings,
    updateAdminLotteryNews,
    uploadBannerImages,
} from '../../controllers/bannerController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.get('/', getPublicBannerSettings);
router.get('/lottery-news', getPublicLotteryNews);
router.get('/admin', verifyAdmin, getAdminBannerSettings);
router.patch('/admin', verifyAdmin, uploadBannerImages, updateAdminBannerSettings);
router.get('/admin/lottery-news', verifyAdmin, getAdminLotteryNews);
router.patch('/admin/lottery-news', verifyAdmin, updateAdminLotteryNews);

export default router;
