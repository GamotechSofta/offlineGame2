import express from 'express';
import {
    genericWalletCredit,
    genericWalletDebit,
    getGenericWalletBalance,
    verifyGenericPartnerAuth,
} from '../../controllers/genericsController/genericWalletController.js';

const genericRouter = express.Router();

genericRouter.use(verifyGenericPartnerAuth);

genericRouter.post('/wallet/balance', getGenericWalletBalance);
genericRouter.post('/wallet/debit', genericWalletDebit);
genericRouter.post('/wallet/credit', genericWalletCredit);

export default genericRouter;