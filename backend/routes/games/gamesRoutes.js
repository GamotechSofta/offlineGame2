import express from 'express';
import {
    getAllGamesForAdmin,
    createGame,
    deleteGame,
    getGameByCode,
    getGames,
    launchGame,
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

// Public
gamesRouter.get('/', getGames);
gamesRouter.get('/:gameCode', getGameByCode);
gamesRouter.post('/launch/:gameCode', verifyUser, launchGame);

export default gamesRouter;
