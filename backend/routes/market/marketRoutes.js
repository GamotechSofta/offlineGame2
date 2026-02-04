import express from 'express';
import {
    createMarket,
    getMarkets,
    getMarketById,
    getMarketResultHistory,
    getMarketStats,
    updateMarket,
    setOpeningNumber,
    setClosingNumber,
    setWinNumber,
    deleteMarket,
    previewDeclareOpenResult,
    declareOpenResult,
    previewDeclareCloseResult,
    declareCloseResult,
    clearResult,
} from '../../controllers/marketController.js';
import { verifyAdmin, verifySuperAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// Public routes
router.get('/get-markets', getMarkets);
router.get('/get-market/:id', getMarketById);
router.get('/result-history', getMarketResultHistory);

// Admin: market detail stats (amount & no. of bets per option)
router.get('/get-market-stats/:id', verifyAdmin, getMarketStats);

// Super admin: declare result (preview, declare open, declare close)
router.get('/preview-declare-open/:id', verifySuperAdmin, previewDeclareOpenResult);
router.get('/preview-declare-close/:id', verifySuperAdmin, previewDeclareCloseResult);
router.post('/declare-open/:id', verifySuperAdmin, declareOpenResult);
router.post('/declare-close/:id', verifySuperAdmin, declareCloseResult);
router.post('/clear-result/:id', verifySuperAdmin, clearResult);

// Super admin only - market management
router.post('/create-market', verifySuperAdmin, createMarket);
router.patch('/update-market/:id', verifySuperAdmin, updateMarket);
router.patch('/set-opening-number/:id', verifySuperAdmin, setOpeningNumber);
router.patch('/set-closing-number/:id', verifySuperAdmin, setClosingNumber);
router.patch('/set-win-number/:id', verifySuperAdmin, setWinNumber);
router.delete('/delete-market/:id', verifySuperAdmin, deleteMarket);

export default router;
