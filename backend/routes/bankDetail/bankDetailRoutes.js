import express from 'express';
import {
    getMyBankDetails,
    addBankDetail,
    updateBankDetail,
    deleteBankDetail,
    setDefaultBankDetail,
} from '../../controllers/bankDetailController.js';
import { verifyUser } from '../../middleware/userAuth.js';

const router = express.Router();

// User APIs (player JWT required; userId from token)
router.get('/', verifyUser, getMyBankDetails);
router.post('/', verifyUser, addBankDetail);
router.put('/:id', verifyUser, updateBankDetail);
router.delete('/:id', verifyUser, deleteBankDetail);
router.post('/:id/set-default', verifyUser, setDefaultBankDetail);

export default router;
