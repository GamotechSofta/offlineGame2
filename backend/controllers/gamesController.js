import Game from '../models/games/games.js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GAME_LAUNCH_URL = process.env.GAME_LAUNCH_URL;

const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return Boolean(value);
};

const pickGamePayload = (body = {}) => {
    const payload = {};

    if (body.name !== undefined) payload.name = String(body.name).trim();
    if (body.gameCode !== undefined) payload.gameCode = String(body.gameCode).trim().toUpperCase();
    if (body.image !== undefined) payload.image = String(body.image).trim();
    if (body.category !== undefined) payload.category = String(body.category).trim();
    if (body.provider !== undefined) payload.provider = String(body.provider).trim();
    if (body.isActive !== undefined) payload.isActive = toBoolean(body.isActive);
    if (body.order !== undefined) payload.order = Number(body.order);

    return payload;
};

const validateGamePayload = (payload, { partial = false } = {}) => {
    const requiredFields = ['name', 'gameCode', 'image'];
    if (!partial) {
        for (const field of requiredFields) {
            if (!payload[field]) {
                return `${field} is required`;
            }
        }
    }

    if (payload.order !== undefined && !Number.isFinite(payload.order)) {
        return 'order must be a valid number';
    }

    return null;
};

export const getGames = async (req, res) => {
    try {
        const query = {};
        if ((req.query.includeInactive || '').toString() !== 'true') {
            // Include docs created via manual DB insert where isActive may be missing.
            query.isActive = { $ne: false };
        }

        const games = await Game.find(query).sort({ order: 1, name: 1 }).lean();
        return res.status(200).json({ success: true, data: games });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllGamesForAdmin = async (_req, res) => {
    try {
        const games = await Game.find().sort({ order: 1, name: 1 }).lean();
        return res.status(200).json({ success: true, data: games });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getGameByCode = async (req, res) => {
    try {
        const gameCode = String(req.params.gameCode || '').trim().toUpperCase();
        const includeInactive = (req.query.includeInactive || '').toString() === 'true';
        if (!gameCode) {
            return res.status(400).json({ success: false, message: 'gameCode is required' });
        }

        const query = includeInactive
            ? { gameCode }
            : { gameCode, isActive: { $ne: false } };
        const game = await Game.findOne(query).lean();
        if (!game) {
            return res.status(404).json({ success: false, message: 'Game not found' });
        }

        return res.status(200).json({ success: true, data: game });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const createGame = async (req, res) => {
    try {
        const payload = pickGamePayload(req.body);
        const validationError = validateGamePayload(payload);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const game = await Game.create(payload);
        return res.status(201).json({ success: true, data: game });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'gameCode already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message, errors: error.errors });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateGame = async (req, res) => {
    try {
        const payload = pickGamePayload(req.body);
        const validationError = validateGamePayload(payload, { partial: true });
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const game = await Game.findByIdAndUpdate(
            req.params.id,
            payload,
            { new: true, runValidators: true }
        );

        if (!game) {
            return res.status(404).json({ success: false, message: 'Game not found' });
        }

        return res.status(200).json({ success: true, data: game });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid game ID' });
        }
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'gameCode already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message, errors: error.errors });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteGame = async (req, res) => {
    try {
        const game = await Game.findByIdAndDelete(req.params.id);
        if (!game) {
            return res.status(404).json({ success: false, message: 'Game not found' });
        }
        return res.status(200).json({ success: true, data: { id: game._id } });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid game ID' });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const launchGame = async (req, res) => {
    try {
        const gameCode = String(req.params.gameCode || req.body?.gameCode || '').trim().toUpperCase();
        const externalPlayerId = String(req.body?.externalPlayerId || req.body?.playerId || req.userId || '').trim();

        if (!gameCode) {
            return res.status(400).json({ success: false, message: 'gameCode is required' });
        }
        if (!externalPlayerId) {
            return res.status(400).json({ success: false, message: 'externalPlayerId is required' });
        }

        const game = await Game.findOne({ gameCode, isActive: { $ne: false } }).lean();
        if (!game) {
            return res.status(404).json({ success: false, message: 'Game not found or inactive' });
        }

        const partnerToken = process.env.PARTNER_TOKEN;
        const apiKey = process.env.API_KEY;
        const apiSecret = process.env.API_SECRET;
        if (!partnerToken || !apiKey || !apiSecret) {
            return res.status(500).json({
                success: false,
                message: 'Game launch credentials are not configured',
            });
        }

        const payload = {
            gameCode,
            externalPlayerId,
            currency: String(req.body?.currency || process.env.CURRENCY || 'INR'),
            locale: String(req.body?.locale || 'en'),
            returnUrl: req.body?.returnUrl != null
                ? String(req.body.returnUrl)
                : String(process.env.GAME_RETURN_URL || 'https://singlepana.in'),
        };

        const response = await axios.post(
            GAME_LAUNCH_URL,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'x-api-secret': apiSecret,
                },
                timeout: 15000,
            }
        );

        const launchUrl = response?.data?.launchUrl
            || response?.data?.data?.launchUrl
            || response?.data?.result?.launchUrl
            || response?.data?.url
            || response?.data?.gameUrl
            || response?.data?.sessionUrl
            || response?.data?.redirectUrl
            || null;

        return res.status(200).json({
            success: true,
            gameCode,
            launchUrl,
            data: response.data,
        });
    } catch (error) {
        const partnerError = error?.response?.data;
        const status = error?.response?.status || 500;
        return res.status(status).json({
            success: false,
            message: partnerError?.message || error.message || 'Game launch failed',
            error: partnerError || null,
        });
    }
};

/** Partner hosts allowed to be proxied for iframe embed (Roulette sends X-Frame-Options: DENY). */
const EMBED_PROXY_HOSTS = new Set([
    'roulettegame.craftdigital.in',
    'aviatorgame.craftdigital.in',
    'funtimergame.craftdigital.in',
]);

const buildFrameAncestorsCsp = () => {
    const origins = new Set(["'self'"]);
    const fromEnv = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    for (const o of fromEnv) origins.add(o);
    if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production') {
        origins.add('http://localhost:5173');
        origins.add('http://127.0.0.1:5173');
        origins.add('http://localhost:3010');
    }
    return `frame-ancestors ${[...origins].join(' ')}`;
};

/**
 * Proxy partner HTML so it can load inside our iframe.
 * Roulette blocks direct iframe embed via X-Frame-Options: DENY; Aviator does not.
 */
export const serveEmbedFrame = async (req, res) => {
    try {
        const rawUrl = req.query.url;
        if (!rawUrl || typeof rawUrl !== 'string') {
            return res.status(400).send('url query parameter is required');
        }

        let parsed;
        try {
            parsed = new URL(rawUrl.trim());
        } catch {
            return res.status(400).send('invalid url');
        }

        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return res.status(400).send('invalid protocol');
        }

        if (!EMBED_PROXY_HOSTS.has(parsed.hostname)) {
            return res.status(403).send('host not allowed for embed proxy');
        }

        if (!parsed.searchParams.get('sessionToken')) {
            return res.status(400).send('launch url must include sessionToken');
        }

        const upstream = await axios.get(parsed.toString(), {
            timeout: 20000,
            maxRedirects: 5,
            responseType: 'text',
            headers: {
                Accept: 'text/html,application/xhtml+xml,*/*',
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
            },
            validateStatus: (status) => status < 500,
        });

        if (upstream.status >= 400) {
            return res.status(upstream.status).type('text/plain').send(
                typeof upstream.data === 'string' ? upstream.data : 'upstream error',
            );
        }

        const contentType = upstream.headers['content-type'] || 'text/html; charset=utf-8';
        res.removeHeader('X-Frame-Options');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Security-Policy', buildFrameAncestorsCsp());
        return res.status(200).send(upstream.data);
    } catch (error) {
        return res.status(502).type('text/plain').send(error.message || 'embed proxy failed');
    }
};

