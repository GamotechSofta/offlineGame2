import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import QuizSlotDeclaration from '../models/quiz/QuizSlotDeclaration.js';
import LotteryBoardBet from '../models/quiz/LotteryBoardBet.js';
import { getBetOwnerKey } from '../utils/betOwnerKey.js';
import { getCachedSlotContext } from '../services/quizCacheService.js';
import {
  SLOT_MS,
  isValidISTSlotStartIso,
  isValidISTDayKey,
  istDayKey,
  listSlotStartIsoForISTDay,
  formatDrawLabel,
} from '../services/slotService.js';
import { getOrCreatePick } from '../services/quizPickService.js';
import { resolveWinningShuffledPosition } from '../services/quizPickPositionService.js';

const resolveGameMode = (req) =>
  (String(req.query?.mode || req.body?.mode || '2d').toLowerCase() === '3d' ? '3d' : '2d');

function formatQ(quizId, hintPos) {
  const q = String(quizId).padStart(2, '0');
  if (hintPos == null || !Number.isInteger(hintPos) || hintPos < 0 || hintPos > 99) {
    return `Q${q}--`;
  }
  return `Q${q}-${String(hintPos).padStart(2, '0')}`;
}

/**
 * GET /api/v1/quiz/slot-results?date=YYYY-MM-DD&mode=2d|3d&limit=&page= (IST)
 * Persisted picks only: result = stored hintPosition (never chosenIndex; no recompute).
 */
export const getSlotResultsForDate = async (req, res) => {
  try {
    const gameMode = resolveGameMode(req);
    const maxPos = gameMode === '3d' ? 999 : 99;
    const maxQuizId = gameMode === '3d' ? 3 : 30;
    const date = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    if (!isValidISTDayKey(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing date (IST calendar YYYY-MM-DD).',
      });
    }
    const todayKey = istDayKey();
    if (date > todayKey) {
      return res.status(400).json({
        success: false,
        code: 'FUTURE_DAY',
        message: 'Future IST date is not allowed.',
      });
    }

    const limitRaw = req.query.limit ?? req.query.maxSlots ?? '96';
    const limit = Math.min(96, Math.max(1, parseInt(String(limitRaw), 10) || 96));
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const skip = (page - 1) * limit;
    const now = Date.now();
    const allStarts = listSlotStartIsoForISTDay(date);
    const ended = allStarts.filter((iso) => new Date(iso).getTime() + SLOT_MS <= now);
    const declaredRows = ended.length
      ? await QuizSlotDeclaration.find({ gameMode, slotStartIso: { $in: ended }, declaredAt: { $ne: null } })
        .select('slotStartIso declaredResults')
        .lean()
      : [];
    const declaredSet = new Set((declaredRows || []).map((r) => String(r.slotStartIso || '')).filter(Boolean));
    const declaredResultsBySlot = new Map(
      (declaredRows || []).map((r) => [String(r.slotStartIso || ''), Array.isArray(r.declaredResults) ? r.declaredResults : []]),
    );
    let completed = ended.filter((iso) => declaredSet.has(iso));
    completed.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const hasMore = completed.length > (skip + limit);
    completed = completed.slice(skip, skip + limit);

    if (completed.length === 0) {
      return res.json({
        success: true,
        data: { date, slots: [], pagination: { page, limit, hasMore } },
      });
    }

    const grouped = await QuizSlotPick.aggregate([
      { $match: { gameMode, slotStartIso: { $in: completed } } },
      {
        $project: {
          _id: 0,
          quizId: 1,
          slotStartIso: 1,
          hintPosition: 1,
        },
      },
      {
        $group: {
          _id: '$slotStartIso',
          picks: { $push: { quizId: '$quizId', hintPosition: '$hintPosition' } },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const picksBySlot = new Map(grouped.map((g) => [g._id, g.picks]));

    const slots = [];
    for (const slotStartIso of completed) {
      const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
      const snapshotRows = declaredResultsBySlot.get(slotStartIso) || [];
      const snapshotByQuiz = new Map(
        snapshotRows
          .filter((r) => Number.isInteger(r?.quizId))
          .map((r) => [r.quizId, r.result]),
      );
      const picks = picksBySlot.get(slotStartIso) || [];
      const byQuiz = new Map(picks.map((p) => [p.quizId, p.hintPosition]));
      const results = [];
      for (let quizId = 1; quizId <= maxQuizId; quizId += 1) {
        const hp = snapshotByQuiz.has(quizId) ? snapshotByQuiz.get(quizId) : byQuiz.get(quizId);
        const ok = hp != null && Number.isInteger(hp) && hp >= 0 && hp <= maxPos;
        results.push({ quizId, result: ok ? hp : null });
      }
      slots.push({
        slotStartIso,
        timeLabel: formatDrawLabel(slotEndMs),
        results,
      });
    }

    res.json({
      success: true,
      data: { date, gameMode, slots, pagination: { page, limit, hasMore } },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getSlotResultsForDate', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * GET /api/v1/quiz/slot-results
 * - ?date=YYYY-MM-DD&mode=2d|3d — IST day chart (persisted hintPosition only); optional &maxSlots= (default 96).
 * - ?limit=N&mode=2d|3d — legacy last N completed slots (summary + sale); hintPosition from DB only.
 */
export const getSlotResultsHistory = async (req, res) => {
  if (req.query.date != null && String(req.query.date).trim() !== '') {
    return getSlotResultsForDate(req, res);
  }
  try {
    const gameMode = resolveGameMode(req);
    const maxPos = gameMode === '3d' ? 999 : 99;
    const padLen = gameMode === '3d' ? 3 : 2;
    const maxQuizId = gameMode === '3d' ? 3 : 30;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const now = new Date();

    const declaredSlotRows = await QuizSlotDeclaration.find({ gameMode, declaredAt: { $ne: null } })
      .select('slotStartIso declaredResults')
      .lean();
    const declaredResultsBySlot = new Map(
      (declaredSlotRows || []).map((r) => [String(r.slotStartIso || ''), Array.isArray(r.declaredResults) ? r.declaredResults : []]),
    );
    const declaredSlotStarts = (declaredSlotRows || [])
      .map((r) => String(r.slotStartIso || ''))
      .filter(Boolean);
    if (!declaredSlotStarts.length) {
      return res.json({ success: true, mode: gameMode, data: [] });
    }

    const rows = await QuizSlotPick.aggregate([
      { $match: { gameMode, slotStartIso: { $in: declaredSlotStarts } } },
      {
        $addFields: {
          slotEnd: { $add: [{ $toDate: '$slotStartIso' }, SLOT_MS] },
        },
      },
      { $match: { $expr: { $lte: ['$slotEnd', now] } } },
      {
        $group: {
          _id: '$slotStartIso',
          picks: {
            $push: {
              quizId: '$quizId',
              hintPosition: '$hintPosition',
            },
          },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: limit },
    ]);

    const slotKeys = rows.map((r) => r._id);
    const saleBySlot = {};
    if (gameMode === '2d' && slotKeys.length) {
      const sales = await LotteryBoardBet.aggregate([
        { $match: { slotStartIso: { $in: slotKeys } } },
        { $group: { _id: '$slotStartIso', sale: { $sum: '$totalAmount' } } },
      ]);
      sales.forEach((s) => {
        saleBySlot[s._id] = s.sale;
      });
    }

    const data = rows.map((row) => {
      const slotStartIso = row._id;
      const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
      const picksRaw = [...row.picks]
        .filter((p) => Number.isInteger(p.quizId) && p.quizId >= 1 && p.quizId <= maxQuizId)
        .sort((a, b) => a.quizId - b.quizId);
      const picksByQuiz = new Map(picksRaw.map((p) => [p.quizId, p.hintPosition]));
      const snapshotRows = declaredResultsBySlot.get(slotStartIso) || [];
      const snapshotByQuiz = new Map(
        snapshotRows
          .filter((r) => Number.isInteger(r?.quizId))
          .map((r) => [r.quizId, r.result]),
      );
      const picks = Array.from({ length: maxQuizId }, (_, i) => i + 1).map((quizId) => {
        const hp = snapshotByQuiz.has(quizId) ? snapshotByQuiz.get(quizId) : picksByQuiz.get(quizId);
        const ok = hp != null && Number.isInteger(hp) && hp >= 0 && hp <= maxPos;
        return { quizId, winningPosition: ok ? hp : null };
      });
      const summary = picks.map((p) => {
        if (gameMode === '3d') {
          const setLabel = p.quizId === 1 ? 'A' : p.quizId === 2 ? 'B' : p.quizId === 3 ? 'C' : `Q${String(p.quizId).padStart(2, '0')}`;
          if (p.winningPosition == null) return `Set ${setLabel}--`;
          return `Set ${setLabel}-${String(p.winningPosition).padStart(padLen, '0')}`;
        }
        const q = String(p.quizId).padStart(2, '0');
        if (p.winningPosition == null) return `Q${q}--`;
        return `Q${q}-${String(p.winningPosition).padStart(padLen, '0')}`;
      }).join(', ');
      const ymd = new Date(slotEndMs).toISOString().slice(2, 10).replace(/-/g, '');
      const drawLabel = `GM${ymd}${String(picks.length).padStart(2, '0')}`;
      return {
        slotStartIso,
        slotEndIso: new Date(slotEndMs).toISOString(),
        drawLabel,
        drawLabelEnd: formatDrawLabel(slotEndMs),
        resultsSummary: summary,
        picks,
        sale: saleBySlot[slotStartIso] ?? 0,
        at: new Date(slotEndMs).toISOString(),
      };
    });

    res.json({ success: true, mode: gameMode, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getSlotResultsHistory', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * POST /api/v1/quiz/board-bet
 * Body: { slotStartIso, stakes: [{ quizId, num, amount }] }
 */
export const postBoardBet = async (req, res) => {
  try {
    const { slotStartIso, stakes } = req.body || {};
    if (!slotStartIso || typeof slotStartIso !== 'string') {
      return res.status(400).json({ success: false, message: 'slotStartIso is required' });
    }
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, code: 'INVALID_SLOT', message: 'Invalid slot' });
    }

    const slotStartMs = new Date(slotStartIso).getTime();
    const slotEndMs = slotStartMs + SLOT_MS;
    if (Date.now() >= slotEndMs) {
      return res.status(403).json({
        success: false,
        code: 'SLOT_CLOSED',
        message: 'This draw slot is closed for new stakes.',
      });
    }

    const ctx = getCachedSlotContext();
    if (ctx.slotStartIso !== slotStartIso) {
      return res.status(403).json({
        success: false,
        code: 'SLOT_MISMATCH',
        message: 'Stakes must be for the current server draw slot. Refresh and try again.',
      });
    }

    if (!Array.isArray(stakes) || stakes.length === 0) {
      return res.status(400).json({ success: false, message: 'stakes array is required' });
    }

    const lines = [];
    let addTotal = 0;
    for (const s of stakes) {
      const quizId = Number(s.quizId);
      const num = Number(s.num);
      const amount = Number(s.amount);
      if (!Number.isInteger(quizId) || quizId < 1 || quizId > 30) {
        return res.status(400).json({ success: false, message: 'Invalid quizId in stakes' });
      }
      if (!Number.isInteger(num) || num < 0 || num > 99) {
        return res.status(400).json({ success: false, message: 'Invalid num in stakes' });
      }
      if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000) {
        return res.status(400).json({ success: false, message: 'Invalid amount in stakes' });
      }
      lines.push({ quizId, num, amount });
      addTotal += amount;
    }

    const owner = getBetOwnerKey(req);

    let doc = await LotteryBoardBet.findOne({ betOwnerKey: owner, slotStartIso });
    let createdFresh = false;
    if (!doc) {
      try {
        doc = await LotteryBoardBet.create({
          betOwnerKey: owner,
          slotStartIso,
          lines,
          totalAmount: addTotal,
        });
        createdFresh = true;
      } catch (e) {
        if (e?.code !== 11000) throw e;
        doc = await LotteryBoardBet.findOne({ betOwnerKey: owner, slotStartIso });
      }
    }
    if (!createdFresh && doc) {
      doc = await LotteryBoardBet.findOneAndUpdate(
        { _id: doc._id },
        { $push: { lines: { $each: lines } }, $inc: { totalAmount: addTotal } },
        { new: true },
      );
    }
    if (!doc) {
      return res.status(500).json({ success: false, message: 'Could not save bet' });
    }

    res.status(201).json({
      success: true,
      data: {
        slotStartIso,
        linesAdded: lines.length,
        totalAmount: doc.totalAmount,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('postBoardBet', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * GET /api/v1/quiz/my-board-bets?limit=30
 */
export const getMyBoardBets = async (req, res) => {
  try {
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const owner = getBetOwnerKey(req);
    const docs = await LotteryBoardBet.find({ betOwnerKey: owner })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const now = Date.now();
    const data = [];

    for (const doc of docs) {
      const slotStartMs = new Date(doc.slotStartIso).getTime();
      const slotEndMs = slotStartMs + SLOT_MS;
      const ended = now >= slotEndMs;
      const lineOut = [];
      let wonAmount = 0;

      const quizIds = [...new Set((doc.lines || []).map((l) => l.quizId))];
      let pickMap = {};
      if (quizIds.length) {
        const picks = await QuizSlotPick.find({
          slotStartIso: doc.slotStartIso,
          quizId: { $in: quizIds },
        }).lean();
        const entries = await Promise.all(
          picks.map(async (p) => {
            const pos = await resolveWinningShuffledPosition(p.quizId, doc.slotStartIso, p);
            return [p.quizId, pos];
          }),
        );
        pickMap = Object.fromEntries(entries);
      }

      if (ended && quizIds.length) {
        for (const qid of quizIds) {
          if (pickMap[qid] === undefined) {
            // eslint-disable-next-line no-await-in-loop
            const created = await getOrCreatePick(qid, doc.slotStartIso);
            // eslint-disable-next-line no-await-in-loop
            pickMap[qid] = await resolveWinningShuffledPosition(qid, doc.slotStartIso, created);
          }
        }
      }

      for (const line of doc.lines || []) {
        const winIdx = ended ? pickMap[line.quizId] : null;
        const won = winIdx != null && winIdx === line.num;
        if (won) wonAmount += line.amount;
        lineOut.push({
          quizId: line.quizId,
          num: line.num,
          amount: line.amount,
          cellLabel: formatQ(line.quizId, line.num),
          winningIndex: winIdx != null ? String(winIdx).padStart(2, '0') : null,
          won: ended ? won : null,
        });
      }

      data.push({
        slotStartIso: doc.slotStartIso,
        slotEndIso: new Date(slotEndMs).toISOString(),
        drawLabelEnd: formatDrawLabel(slotEndMs),
        slotEnded: ended,
        totalAmount: doc.totalAmount,
        wonAmount: ended ? wonAmount : null,
        netResult: ended ? wonAmount - doc.totalAmount : null,
        lines: lineOut,
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getMyBoardBets', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};
