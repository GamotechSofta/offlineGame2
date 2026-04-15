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
genericRouter.post('/wallet/balance/:playerId', getGenericWalletBalance);
genericRouter.post('/wallet/debit', genericWalletDebit);
genericRouter.post('/wallet/debit/:playerId', genericWalletDebit);
genericRouter.post('/wallet/credit', genericWalletCredit);
genericRouter.post('/wallet/credit/:playerId', genericWalletCredit);

export default genericRouter;