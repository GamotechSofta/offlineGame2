# Fix "PlatformConstants could not be found" / Red screen

This error happens when Expo is started from the **repo root** (`offlineGame2`) instead of from this folder. The native app (Expo Go) and the JS bundle must come from the **same project** (this `mobile` folder).

## Do this every time

### 1. Run the app only from the `mobile` folder

**From repo root:**
```bash
npm run mobile
```
or:
```bash
./start-mobile.sh
```

**Or from this folder:**
```bash
cd /Users/Smiti/offlineGame2/mobile
npx expo start --clear
```

Then press **a** for Android (or **i** for iOS).

### 2. Do not run from repo root

Do **not** run:
```bash
cd /Users/Smiti/offlineGame2
npx expo start
```
That will cause the PlatformConstants / TurboModuleRegistry error.

### 3. If you still see the red screen

- **Update Expo Go** on your phone (Play Store / App Store) to the latest version.
- **Close Expo Go completely** (swipe it away from recent apps), then run `npm run mobile` again and scan the new QR code.
- **Clear Metro cache:** from repo root run `npm run mobile` but with cache clear:
  ```bash
  cd mobile && npx expo start --clear
  ```
- **Reload the app:** on the device press **Reload (R, R)** or shake the device and choose Reload.
