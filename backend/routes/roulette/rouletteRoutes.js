import express from 'express';
import { verifyUser } from '../../middleware/userAuth.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';
import { validateRouletteSpin } from '../../middleware/validateRouletteSpin.js';
import { responsibleGamingLimits } from '../../middleware/responsibleGaming.js';
import { rouletteAntiAbuse } from '../../middleware/rouletteAntiAbuse.js';
import {
    spinRoulette,
    getRouletteStats,
    getRouletteHistory,
    getRouletteConfig,
    getGlobalStats,
    getProof,
    getExposureStatus,
    getSystemHealth,
    runMonteCarloRoute,
    runLiquidityStressRoute,
    getRTP,
    getRTPCheck,
} from '../../controllers/rouletteController.js';

const router = express.Router();

router.post('/spin', verifyUser, validateRouletteSpin, rouletteAntiAbuse, responsibleGamingLimits, spinRoulette);
router.get('/stats', verifyUser, getRouletteStats);
router.get('/history', verifyUser, getRouletteHistory);
router.get('/config', getRouletteConfig);
router.get('/global-stats', getGlobalStats);
router.get('/proof/:spinId', getProof);
router.get('/rtp', getRTP);
router.get('/rtp-check', verifyAdmin, getRTPCheck);
router.get('/exposure-status', verifyAdmin, getExposureStatus);
router.get('/system-health', verifyAdmin, getSystemHealth);
router.post('/monte-carlo', verifyAdmin, runMonteCarloRoute);
router.post('/liquidity-stress', verifyAdmin, runLiquidityStressRoute);

export default router;
