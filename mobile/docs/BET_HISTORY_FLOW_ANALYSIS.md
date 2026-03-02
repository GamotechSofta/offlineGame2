# Bet History Screen – Flow Analysis (Mobile)

## 1. Entry & Navigation

| Step | What happens |
|------|----------------|
| **Entry** | User taps **My Bets** in bottom nav or hamburger menu → `InnerStackNavContext` ref is used to call `innerNavRef.current.navigate('BetHistory')` → `BetHistoryScreen` mounts inside the Main stack. |
| **Back** | Header back button calls `navigation.goBack()` → returns to previous screen in the inner stack (e.g. Home). |

**Files:** `BottomNavbar.js`, `AppHeader.js` (use `InnerStackNavContext`), `MainNavigator.js` (registers `BetHistory` screen).

---

## 2. Auth & Data Loading

### 2.1 User and loading trigger

- **User:** `userId = user?._id || user?.id` from `useAuth()`.
- **Load:** `loadHistory()` runs when the screen gets focus via `useFocusEffect(loadHistory)`.
- If **no userId**: `loadHistory` sets `rawList = []`, `markets = []`, `ratesMap = null`, `loading = false` and returns without calling APIs.

### 2.2 APIs called (when `userId` exists)

`loadHistory()` runs **in parallel**:

| API | Function | Purpose |
|-----|----------|--------|
| Bet history | `getBetHistory()` | List of user’s bets from backend. |
| Markets | `getMarkets()` | All markets (for open/close numbers and names). |
| Rates | `getRatesCurrent()` | Current rates for payout calculation. |

**Implementation:**

- **`getBetHistory()`** (`api/bets.js`):
  - Uses `getUserCache()` for `user.id` / `user._id`.
  - If no user → returns `{ success: false, message: 'Please log in', data: [] }`.
  - Builds URL: `GET ${API_BASE_URL}/bets/history?userId=<uid>` (optional `startDate`/`endDate`).
  - Uses **plain `fetch(url, { headers: getAuthHeaders() })`** (not `fetchWithAuth`), so **401 does not trigger global logout or redirect to Login**.
  - **401:** returns `{ success: false, message: 'Session expired.', data: [] }`; user stays on Bet History and sees "No bets found."
  - On success, expects `data` to be an array; screen uses `historyRes.data` as `rawList`.

- **`getMarkets()`**: `GET /markets/get-markets` (no auth). Response `data` → `markets`.

- **`getRatesCurrent()`**: `GET /rates/current` (no auth). Response `data` → `ratesMap` for payout multipliers.

### 2.3 Loading and error handling

- **Loading:** `loading` is set true at start, false in `finally`. While true, screen shows header + centered spinner + “Loading...”.
- **No user:** After load, if `!userId`, empty state shows “No bets found (no redirect to Login).”
- **Errors:** On catch, `rawList` is set to `[]`; markets/rates keep previous or default. No toast/alert; user just sees “No bets found.” if list is empty.

---

## 3. Data Shape & Transformations

### 3.1 Backend → rawList

Backend **`/bets/history`** is assumed to return an array of bet objects, e.g.:

- `_id`, `marketId` (object with `marketName` or string), `betOn` ('open'/'close'), `amount`, `betType`, `betNumber`, `createdAt`, etc.

Screen does **not** persist or merge this with any local list; it’s display-only from API.

### 3.2 rawList → flat (one row per bet)

```js
flat = rawList.map(bet => ({
  x: bet,
  r: bet,
  idx: bet?._id,
  session: betOn === 'close' ? 'CLOSE' : 'OPEN',
  marketTitle: from marketId.marketName or marketId,
  points: bet.amount,
  gameType: betTypeToLabel(bet.betType),
  betNumber: bet.betNumber ?? '-',
  createdAt: bet.createdAt,
}));
```

So **one API bet = one row** in the list. No “group by entry” like on frontend.

### 3.3 flat → enriched (add win/loss verdict)

For each row:

- **Market lookup:** `market = marketByName.get(normalizeMarketName(row.marketTitle))` (from `markets`).
- **Verdict:** `evaluateBet({ market, betNumberRaw: row.betNumber, amount: row.points, session: row.session, ratesMap })` → `{ state: 'won'|'lost'|'pending', kind, payout }`.

So **enriched** = flat rows + `verdict` (state + payout).

### 3.4 evaluateBet (win/loss logic)

- Uses market’s `openingNumber` / `closingNumber` (3-digit strings), derives open/close digit and jodi.
- **Bet kind** from `betNumber`: digit, jodi, panna, half-sangam (open/close), full-sangam.
- **Declared:** whether result exists for that kind/session (e.g. open digit, close panna).
- If not declared → `state: 'pending'`.
- If declared and matches → `state: 'won'`, `payout = amount * getPayoutMultiplier(kind, betNumber, ratesMap)`.
- If declared and doesn’t match → `state: 'lost'`.

Same logic as frontend; uses `DEFAULT_RATES` when `ratesMap` is missing.

### 3.5 enriched → filtered (filters)

Applied in order:

1. **Session:** if `selectedSessions.length > 0`, row must have `row.session` in `selectedSessions` (OPEN/CLOSE).
2. **Market:** if `selectedMarkets.length > 0`, `normalizeMarketName(row.marketTitle)` must be in `selectedMarkets`.
3. **Status:** if `selectedStatuses.length > 0`, row’s `verdict.state` mapped to 'Win'|'Loose'|'Pending' must be in `selectedStatuses`.

### 3.6 filtered → paged (pagination)

- **PAGE_SIZE = 10.**
- `totalPages = ceil(filtered.length / PAGE_SIZE)`.
- `paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)`.
- Page resets to 1 when filters or `enriched.length` change (effect).

---

## 4. UI Flow

### 4.1 States

| State | UI |
|-------|----|
| Loading | Header + “Loading...” + spinner. |
| No userId | “No bets found (no redirect to Login).” |
| No bets (after load) | “No bets found.” |
| Has data | List of cards (see below) + optional pagination bar. |

### 4.2 Card content (per row)

- **Header:** `MARKET_TITLE (OPEN|CLOSE)`.
- **Body:** Game Type (from `betType`), “Pana” (actually shows `betNumber`), Points.
- **Transaction:** “Transaction: &lt;formatted date/time&gt;” from `createdAt`.
- **Status:**  
  - Won: “Congratulations, You Won ₹&lt;payout&gt;” (green).  
  - Lost: “Better Luck Next time” (red).  
  - Pending: “Bet Placed” (green style).

### 4.3 Filter modal

- **By Game Type:** OPEN / CLOSE (toggle chips; stored in `draftSessions`).
- **By Winning Status:** Win / Loose / Pending (`draftStatuses`).
- **By Games:** List of market names from `marketOptions` (from enriched rows); selection in `draftMarkets`.
- **Apply:** Copies draft → `selectedSessions`, `selectedStatuses`, `selectedMarkets`, sets page to 1, closes modal.
- **Cancel:** Closes modal without applying.

### 4.4 Pagination

- Shown only if `filtered.length > PAGE_SIZE`.
- PREV / current page number / NEXT; clamped to `[1, totalPages]`.
- Positioned above bottom nav (`bottom: BOTTOM_NAV_HEIGHT + insets.bottom + 12`).

---

## 5. No Login Redirect from Bet History

- **getBetHistory** uses **plain fetch** with getAuthHeaders() (not fetchWithAuth).
- On **401**, `api.js`’s `fetchWithAuth` returns failure with data: []; screen shows "No bets found." and user stays on Bet History (no redirect).
- So: if the user’s token is expired or invalid, opening Bet History (or any focus that triggers `loadHistory`) can immediately redirect to Login. This is why “My Bets” can appear to “open Login” even when navigation to Bet History is correct.

---

## 6. Mobile vs Frontend (Bet History)

| Aspect | Mobile | Frontend |
|--------|--------|----------|
| **Data source** | Backend `GET /bets/history` (live). | `localStorage.getItem('betHistory')` (client-stored entries with `rows`). |
| **Structure** | One API bet = one row. | Entries with `marketTitle`, `session`, `rows: [{ number, points, type, ... }]`. |
| **Refresh** | On every **focus** (`useFocusEffect`). | On mount + interval for markets; bet list from localStorage + `localVersion`. |
| **Market scope** | All markets; no starline/main split in UI. | Can scope by `marketScope` (main vs starline); filters by `inScope`. |
| **Settled state** | Computed only (no persisted settledState/settledPayout). | Can persist `settledState`/`settledPayout` in localStorage and prefer over computed. |
| **Filter UI** | Modal with chips (sessions, status) and market list. | Same idea; modal with checkboxes. |
| **Pagination** | 10 per page; PREV/NEXT bar. | Same PAGE_SIZE and similar bar. |
| **Back** | `navigation.goBack()`. | `navigate(-1)`. |

---

## 7. Summary Flow Diagram

```
[User taps My Bets]
       →
[BetHistoryScreen mounts]
       →
[useFocusEffect → loadHistory()]
       →
userId? ─No→ Show "No bets found."; no API; no redirect.
       │
       Yes
       →
[Promise.all: getBetHistory(), getMarkets(), getRatesCurrent()]
       →
401 or error on getBetHistory? → return { success: false, data: [] }; setRawList([]); stay on Bet History
       →
OK → setRawList, setMarkets, setRatesMap; setLoading(false)
       →
[flat] = one row per bet from rawList
       →
[enriched] = flat + evaluateBet(…) → verdict (won/lost/pending + payout)
       →
[filtered] = apply session / market / status filters
       →
[paged] = slice for current page (10 items)
       →
Render: header (back + title + Filter By) + ScrollView of cards + optional pagination bar + filter modal.
```

---

## 8. Possible Improvements (reference)

- **401 on Bet History:** Handled locally; user stays on Bet History; “Session expired. Please log in again.” on the same screen and then redirect, so the user understands why they see Login.
- **Pull-to-refresh:** Add refresh control on ScrollView to call `loadHistory()` again.
- **Market scope:** If backend supports starline vs main, add scope or filter similar to frontend.
- **Inner nav ref:** Ensure `BetHistoryScreen` (and other tab screens) call `useSetInnerNavRef()` so that when this screen is focused, the inner stack ref is set and “My Bets” / other tabs keep working without touching the root navigator.
