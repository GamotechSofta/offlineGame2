# Games Mobile (React Native / Expo)

React Native conversion of the web frontend. Same logic and UI/UX as the web app.

## Setup

1. **Install dependencies**
   ```bash
   cd mobile && npm install
   ```

2. **Add app icons (required by Expo)**  
   Place these in `mobile/assets/`:
   - `icon.png` (1024×1024)
   - `splash.png` (splash screen)
   - `adaptive-icon.png` (Android, 1024×1024)

   Or run with Expo defaults until you add them.

3. **API URL**  
   Set your API base URL:
   - Create `mobile/.env` with `EXPO_PUBLIC_API_BASE_URL=https://your-api.com/api/v1`
   - Or set in `app.json` → `expo.extra.EXPO_PUBLIC_API_BASE_URL`

4. **Run (important: always from the `mobile` folder)**
   From the **repo root**:
   ```bash
   npm run mobile
   ```
   Or from the **mobile** folder:
   ```bash
   cd mobile
   npx expo start --clear
   ```
   Then press `i` for iOS simulator or `a` for Android.

   **Do not run `npx expo start` from the repo root** — that causes a "PlatformConstants could not be found" / TurboModuleRegistry error because the native app (Expo Go) and the JS bundle must use the same project (this folder).

## Structure

- `App.js` – Root: SafeAreaProvider, AuthProvider, NavigationContainer, MainNavigator.
- `src/config/` – API base URL, auth headers, AsyncStorage-backed storage.
- `src/context/AuthContext.js` – User state, login/logout, balance.
- `src/navigation/` – Stack navigator: Login | Main (with AppHeader + screens + BottomNavbar).
- `src/components/` – AppHeader, BottomNavbar, HeroSection, Section1, GameBid (BidLayout, BettingWindowContext, bids/*).
- `src/screens/` – Home, Login, BidOptions, GameBid, Bank, Funds, Bids, Profile, Passbook, Download, Support, etc.
- `src/api/bets.js` – placeBet, getBalance, getMyWalletTransactions, getRatesCurrent (same API as web).
- `src/utils/marketTiming.js` – isBettingAllowed, isPastClosingTime, getTodayIST (unchanged).
- `src/hooks/` – useHeartbeat (AppState), useRefreshOnMarketReset (AppState).

## Converted from web

- **Fully converted:** Home, Login, BidOptions, GameBid (SingleDigitBid + BidLayout + BidReviewModal), Bank, Funds (list), Profile, Support (landing), Download.
- **Placeholder / to finish:** Other bid types (Jodi, Pana, Sangam, etc.), Bids list, Passbook, Support New/Status, BetHistory, MarketResultHistory, TopWinners, StartlineDashboard. Copy logic from `frontend/src/pages/` and replace web elements with React Native (View, Text, TouchableOpacity, TextInput, ScrollView, etc.).

## Differences from web

- **Storage:** `localStorage` → `AsyncStorage` (via `src/config/storage.js` and user cache for sync auth).
- **Routing:** `react-router-dom` → React Navigation (stack + screen names).
- **Styling:** Tailwind classes → `StyleSheet` / inline styles.
- **DOM:** `div`, `button`, `input` → `View`, `TouchableOpacity`, `TextInput`.
- **Events:** `window.dispatchEvent('userLogin')` → `subscribeUserChange` and AuthContext.
