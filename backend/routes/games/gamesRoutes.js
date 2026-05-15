import express from 'express';
import {
    getAllGamesForAdmin,
    createGame,
    deleteGame,
    getGameByCode,
    getGames,
    launchGame,
    serveEmbedFrame,
    updateGame,
} from '../../controllers/gamesController.js';
import { verifyAdmin, verifySuperAdmin } from '../../middleware/adminAuth.js';
import { verifyUser } from '../../middleware/userAuth.js';

const gamesRouter = express.Router();

// Admin
gamesRouter.get('/admin/all', verifyAdmin, getAllGamesForAdmin);
gamesRouter.post('/create-game', verifySuperAdmin, createGame);
gamesRouter.patch('/update-game/:id', verifySuperAdmin, updateGame);
gamesRouter.delete('/delete-game/:id', verifySuperAdmin, deleteGame);

// Public — must be registered before /:gameCode
gamesRouter.get('/embed/frame', serveEmbedFrame);
gamesRouter.get('/', getGames);
gamesRouter.get('/:gameCode', getGameByCode);
gamesRouter.post('/launch/:gameCode', verifyUser, launchGame);

export default gamesRouter;
