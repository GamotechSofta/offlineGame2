import express from 'express';
import {
    getMyBankDetails,
    addBankDetail,
    updateBankDetail,
    deleteBankDetail,
    setDefaultBankDetail,
} from '../../controllers/bankDetailController.js';

const router = express.Router();

// User APIs (userId passed in body/query)
router.get('/', getMyBankDetails);
router.post('/', addBankDetail);
router.put('/:id', updateBankDetail);
router.delete('/:id', deleteBankDetail);
router.post('/:id/set-default', setDefaultBankDetail);

export default router;
