# Roulette Game — Technical & Product Info

This document describes the roulette game: rules, architecture, API, configuration, and operations.

---

## 1. Game overview

- **Type:** European roulette (single zero: 0–36).
- **Result:** One number 0–36 per spin. 0 is green; 1–36 are red or black (18 each).
- **Flow:** User places bets → spin → RNG resolves winning number → payouts applied → balance and history updated.

### 1.1 Bet types (production)

| Type     | Description              | Payout  | Example / value |
|----------|--------------------------|---------|------------------|
| `number` | Straight (one number)    | 35 : 1  | `{ type: 'number', value: 17, amount: 10 }` value 0–36 |
| `split`  | Two adjacent numbers     | 17 : 1  | `{ type: 'split', value: [1,2] or '1-2', amount: 10 }` |
| `street` | Row of 3 (e.g. 1–3)      | 11 : 1  | `{ type: 'street', value: 1..12, amount: 10 }` |
| `corner` | Block of 4               | 8 : 1   | `{ type: 'corner', value: [1,2,4,5] or '1-2-4-5', amount: 10 }` |
| `sixline`| Two rows (6 numbers)     | 5 : 1   | `{ type: 'sixline', value: 0..10, amount: 10 }` |
| `dozen`  | 1–12, 13–24, 25–36       | 2 : 1   | `{ type: 'dozen', value: 1|2|3, amount: 10 }` |
| `column` | Column (12 numbers)      | 2 : 1   | `{ type: 'column', value: 1|2|3, amount: 10 }` |
| `red` / `black` | Colour   | 1 : 1   | `{ type: 'red', amount: 50 }` |
| `odd` / `even` / `low` / `high` | Even-money | 1 : 1 | `{ type: 'odd', amount: 20 }` |

- **Red numbers:** 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36.
- **0 (green):** All even-money bets (red, black, odd, even, low, high) lose.

### 1.2 Win rate (fair game, no RNG steering)

Win rate = (gamesWon / gamesPlayed) × 100. A spin counts as a “win” when payout > 0. The game uses **fair European roulette**: no probability steering or RNG manipulation.

- **Only even-money bets** (red/black/odd/even/low/high): win on 18 of 37 numbers → **~48.65%** of spins.
- **Only straight-up** (one number): win on 1 of 37 → **~2.7%** of spins.
- **Mix of both:** typically **~35–45%**; many players see a win rate around **40%**. This is a normal outcome; no extra logic is required to “get” 40%.

*(Optional product ideas without changing fairness: in-app copy explaining that ~40% is typical for mixed bets; a “Target: 40%” UX hint; or a loyalty bonus when win rate over the last N spins is below 40%.)*

### 1.3 House edge (owner protection)

The game uses **standard European roulette** with **no outcome manipulation**. The house is protected by the **built-in mathematical edge**:

- **37 pockets** (0–36). Payouts are set as in real casinos (e.g. 35:1 for straight-up, 1:1 for even-money).
- **House edge = 1/37 ≈ 2.7%** of total amount wagered. Over many spins, the house expects to keep ~2.7% of all wagers.
- **Accounting:** Each spin: `houseProfit = totalBet - payout`. This is applied to `HouseReserve` and reflected in `RouletteStats` (totalWagered, totalPaid). So `houseProfit = totalWagered - totalPaid` over time.

**Why the owner profits in production:**

| Concept | Explanation |
|--------|-------------|
| Fair RNG | `crypto.randomInt(0, 37)` — each number 0–36 has probability 1/37. No steering. |
| Correct payouts | Straight-up: 36× return (35:1 + stake). Even-money: 2× on win; 0 loses on green. |
| Expected value | Per unit wagered, player EV ≈ −2.7%; house EV ≈ +2.7%. |
| Short-term variance | Over 100–1000 spins the house can be down; that is normal. Over 10k+ spins, house profit converges to ~2.7% of total wagered. |

**Verification:** Run `node backend/scripts/houseEdgeVerification.js` to simulate many spins and print total wagered, total paid, house profit, and effective house edge %. Do **not** change the RNG or payouts to "fix" results; the math already guarantees long-term house profit.

---

## 2. Backend structure

```
backend/
├── engine/                    # Pure logic (no DB)
│   ├── wheel.js               # RNG: spin() → 0–36 (crypto.randomInt)
│   ├── rouletteBets.js        # Bet type definitions, number coverage, payout multipliers
│   ├── payout.js              # validateBets, calculatePayout, maxPayoutForBets (all bet types)
│   ├── exposure.js            # Exposure: reserve, per-number (numberExposure), liability cap
│   ├── numberExposure.js      # numberExposure map; 2–3% bankroll cap per number
│   ├── exposureStatus.js      # Liability by number/bet type, exposure ratio
│   ├── provablyFair.js        # Server/client seed + nonce → HMAC → number; verifySpin
│   ├── operationalPolicy.js  # Reserve thresholds, reject bet (exposureMultiplier), freeze high-risk
│   ├── riskController.js     # Dynamic limits (bankroll/500), reserve ratio (40%)
│   └── simulator.js           # Monte Carlo: runSpins, runMonteCarlo
│
├── models/rouletteGame/
│   ├── rouletteGame.js        # Spin record (spinId, user, bets, winningNumber, payout, profit, seeds, idempotencyKey)
│   ├── RouletteStats.js       # Global stats (totalWagered, totalPaid, spinCount)
│   ├── RouletteSeedCycle.js   # Provably fair cycle (serverSeedHash, serverSeed, activeFrom, revealedAt)
│   ├── rouletteConfig.js      # Config (houseReserve, riskFactor, limits, provablyFairEnabled)
│   ├── HouseReserve.js        # House balance (single doc)
│   ├── RouletteAuditLog.js    # Append-only chain (sequenceId, spinId, recordHash, payload)
│   └── RiskAlert.js           # AML/risk alerts (no RNG)
│
├── services/
│   ├── spinService.js         # Main flow: validate → exposure → resolve number → payout → persist (transaction)
│   ├── rtpMonitor.js          # RTP = totalPaid/totalWagered; deviation check (~97.3%)
│   └── liquiditySimulator.js  # Stress test (maxDrawdown, requiredReserveForRuin01)
│
├── controllers/
│   └── rouletteController.js  # spinRoulette, getRouletteStats, getRouletteHistory, config, global-stats, proof, exposure-status, system-health, monte-carlo, liquidity-stress
│
├── routes/roulette/
│   └── rouletteRoutes.js      # POST /spin, GET /stats, /history, /config, /global-stats, /proof/:spinId, etc.
│
├── middleware/
│   ├── validateRouletteSpin.js  # userId, bets array, idempotencyKey format
│   ├── responsibleGaming.js     # Placeholder for limits, self-exclusion, cool-off
│   └── rouletteAntiAbuse.js     # Spin rate limit per user; optional strict mode (ROULETTE_ANTIABUSE_STRICT)
│
└── scripts/
    ├── rngStatisticalCheck.js   # Chi-square uniformity check for RNG
    ├── rouletteSimulation.js   # Batch run using engine/simulator
    └── houseEdgeVerification.js # House profit over N spins; verifies ~2.7% house edge
```

---

## 3. Spin flow (spinService)

1. **Validate** — `userId` present; `bets` array valid (type, amount, number 0–36).
2. **Cooldown** — 2 s per user between spins (rate limit).
3. **User & wallet** — User exists, active; wallet balance ≥ total bet.
4. **Idempotency** — If same `user` + `idempotencyKey` already exists, return stored result (no double debit).
5. **Operational policy** — Reserve vs thresholds: table not halted; high-risk (e.g. straight-up) not frozen if configured.
6. **Exposure** — Max payout vs house bankroll, table liability cap, per-number straight-up limit, per-bet-type limits.
7. **Debit** — Deduct total bet from wallet; create debit `WalletTransaction`.
8. **Resolve number** — Provably fair (server + client seed + nonce) if enabled and seeds present; else `spin()` from `wheel.js`.
9. **Payout** — `calculatePayout(bets, winningNumber)`; credit wallet and create credit transaction if payout > 0.
10. **Persist** — Update user (gamesPlayed, totalWagered, gamesWon, totalWon, biggestWin); `RouletteStats.incrementSpin`; `HouseReserve.addHouseProfit`; append `RouletteAuditLog`; create `RouletteGame`; commit transaction.

All of the above runs inside a **MongoDB transaction**; on error the transaction is aborted.

---

## 4. API reference

Base path: **`/api/v1/roulette`**. Auth: JWT via `Authorization: Bearer <token>` unless noted.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST   | `/spin` | User | Execute one spin. Body: `{ userId?, bets, idempotencyKey?, clientSeed?, nonce? }`. `userId` can come from token. |
| GET    | `/stats` | User | Per-user stats. Query: `userId` (or from token). Returns: gamesPlayed, gamesWon, totalWagered, totalWon, biggestWin, winRate. |
| GET    | `/history` | User | Last N spins for user. Query: `userId?`, `limit` (default 10, max 100). |
| GET    | `/config` | — | Public config (houseReserve, riskFactor, limits, provablyFairEnabled, etc.). |
| GET    | `/global-stats` | — | Global RouletteStats (totalWagered, totalPaid, spinCount). |
| GET    | `/proof/:spinId` | — | Provably fair proof for spin (serverSeedHash, clientSeed, nonce, winningNumber). |
| GET    | `/rtp` | — | Current RTP (totalPaid/totalWagered), expected ~97.3%. |
| GET    | `/rtp-check` | Admin | RTP deviation check; optional query `threshold` (default 0.05). |
| GET    | `/exposure-status` | Admin | Liability by number/bet type, reserve, exposure ratio. |
| GET    | `/system-health` | Admin | Reserve balance, table halted?, config snapshot. |
| POST   | `/monte-carlo` | Admin | Body: `{ bets, numSpins }`. Returns runMonteCarlo result. |
| POST   | `/liquidity-stress` | Admin | Body: `{ bets, numSpins }`. Returns maxDrawdown, requiredReserveForRuin01, etc. |

### 4.1 Spin request/response

**Request body (POST /spin):**

```json
{
  "bets": [
    { "type": "number", "value": 17, "amount": 10 },
    { "type": "red", "amount": 50 }
  ],
  "idempotencyKey": "optional-uuid-or-string",
  "clientSeed": "optional-for-provably-fair",
  "nonce": 0
}
```

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "spinId": "uuid",
    "winningNumber": 17,
    "payout": 360,
    "balance": 1234.56,
    "profit": 300,
    "idempotent": false
  }
}
```

**Error (4xx/5xx):** `{ "success": false, "message": "..." }`. Optional `code` (e.g. `RATE_LIMIT` for 429).

---

## 5. Configuration (RouletteConfig)

- **Config key:** `main` (single document: `RouletteConfig.findOne({ key: 'main' })`).

| Field | Meaning | Default |
|-------|---------|---------|
| houseReserve | Virtual house bankroll for exposure | 1e9 |
| riskFactor | Max single-spin exposure as fraction of houseReserve | 0.1 |
| tableLiabilityCap | Optional cap on total table liability | — |
| maxStraightUpPerNumber | Max straight-up liability per number | 100000 |
| reducedStraightUpLimit | When high-risk frozen, use this lower limit | — |
| reserveHaltThreshold | Halt table if reserve ≤ this | 0 |
| highRiskFreezeThreshold | Freeze high-risk bets if reserve ≤ this | 0 |
| maxSingleSpinReserveFraction | (Legacy) Previously used for single-spin halt; superseded by exposureMultiplier. | 0.5 |
| exposureMultiplier | Reject bet (before spin) when maxPayout > reserveForCheck × this. reserveForCheck = max(reserve, minReserveRequired). Does not halt table. | 5 |
| minReserveRequired | Minimum reserve used in exposure check so low reserve does not block normal bets. | 1000 |
| maxExposurePctOfBankroll | Per-number exposure cap (e.g. 0.025 = 2.5%). Reject bet if any number’s potential payout exceeds this fraction of bankroll. | 0.025 |
| reserveRatio | Reserve as fraction of bankroll (e.g. 0.4 = 40%). When operational balance approaches this, dynamic limits reduce. | 0.4 |
| bankrollDivisorStraight | Dynamic max straight bet = bankroll / this (e.g. 500). | 500 |
| perBetTypeLimits | e.g. `{ "number": 5000, "red": 10000 }` | — |
| kellyFraction | Optional Kelly-style fraction | — |
| provablyFairEnabled | Use server/client seed + nonce for number | false |

---

## 6. Provably fair (optional)

- When `provablyFairEnabled` and `clientSeed` + `nonce` are sent:
  - Active **RouletteSeedCycle** (unrevealed) provides `serverSeed`.
  - Number = `getWinningNumberFromSeeds(serverSeed, clientSeed, nonce)` (HMAC-SHA256 then mod 37).
- Before reveal, only `serverSeedHash` is stored; after reveal, `serverSeed` can be stored for verification.
- **GET /proof/:spinId** returns serverSeedHash, clientSeed, nonce, winningNumber for verification.

---

## 7. Audit & compliance

- **RouletteAuditLog:** Append-only chain; each record has `sequenceId`, `spinId`, `previousRecordHash`, `recordHash`, `timestamp`, `payloadHash`, `payload`. Used for replay and tamper detection.
- **RouletteGame:** Each spin stored with spinId, user, bets, winningNumber, totalBet, payout, profit, spinDataHash, idempotencyKey, optional clientSeed/nonce/serverSeedHash.
- **HouseReserve:** Single document; house profit/loss per spin applied atomically inside the same transaction as the spin.

---

## 8. Frontend (player app)

- **Routes:** `/roulette` and `/games/roulette` (both render RouletteGame; navbar/header hidden).
- **Entry:** Dedicated "Play Roulette" banner under hero on Home: “Play Roulette” → navigates to `/roulette`. Route `/games/roulette` also opens the same game.
- **Flow:** Enter amount → place bets (number grid 0–36 + quick bets red/black/odd/even/low/high) → Spin → result modal (winning number, payout, profit) + balance update.
- **API usage & auth:** All roulette requests send JWT (frontend uses `fetchWithAuth`; 401 clears session). Balance: GET `/api/v1/wallet/balance`. GET `/api/v1/roulette/stats?userId=...`, GET `/api/v1/roulette/history?userId=...&limit=10` (limit default 10, max 100), POST `/api/v1/roulette/spin` with body `{ userId?, bets, idempotencyKey }`. Server may use userId from token.

---

## 9. Scripts

- **rngStatisticalCheck.js** — Samples many spins, runs chi-square test for uniformity over 0–36.
- **rouletteSimulation.js** — Runs a Monte Carlo batch (e.g. 5000 spins) with a **mixed bet profile** (e.g. one number + red: `{ type: 'number', value: 17, amount: 10 }`, `{ type: 'red', amount: 50 }`); logs total profit, win rate, max drawdown.

---

## 10. User model (roulette-related fields)

Optional fields on **User** for per-user roulette stats (also derivable from RouletteGame):

- `gamesPlayed` — number of spins.
- `gamesWon` — spins with payout > 0.
- `totalWagered` — sum of totalBet.
- `totalWon` — sum of payout.
- `biggestWin` — max payout in one spin.

These are updated inside the spin transaction when the user document is loaded with these fields.

---

## 11. Implementation verification (flow & rules)

- **Backend:** European wheel 0–36; payouts: straight-up 35:1 (return 36× stake), even-money 1:1 (return 2×); 0 loses all even-money. RNG via `crypto.randomInt(0, 37)`; optional provably fair. Spin flow: validate → cooldown 2s → user/wallet → idempotency → policy → exposure → debit → resolve number → payout → persist in one transaction. Exposure: reject bet (403) when maxPayout > max(reserve, minReserveRequired) × exposureMultiplier; table is never halted for low reserve, only the current bet is rejected.
- **Frontend:** Place bets (number 0–36 + red/black/odd/even/low/high) → Spin → wheel animates 5s → result and balance update. Spin button stays disabled until the wheel animation finishes to avoid double-spin and keep flow clear. Bet payload: `number` sends `{ type, value, amount }`; other types send `{ type, amount }`.
- **Routes:** Player: `/roulette`, `/games/roulette` (no header/nav). API: `/api/v1/roulette` (spin, stats, history, config, etc.). Admin: `/api/v1/admin/roulette/records` and `/roulette/config`; bookie sees referred players only.

---

This file is the single source of detail for the roulette game: rules, structure, APIs, config, and operations.
