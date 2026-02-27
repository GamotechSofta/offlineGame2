this is read me file

## Mobile app (Expo)

**To run the mobile app and avoid the "PlatformConstants could not be found" red screen**, start it from the **mobile** project:

From repo root, use either:

```bash
npm run mobile
```

or:

```bash
./start-mobile.sh
```

Or open a terminal in the `mobile` folder and run:

```bash
cd mobile
npx expo start --clear --port 8082
```

**If the app doesn't start** (e.g. "Port 8081 is in use"): stop any other Expo/Metro process (close the terminal where you ran `npx expo start` from the repo root, or run `lsof -ti:8081 | xargs kill`), then run `npm run mobile` again.

Then press **a** for Android (or **i** for iOS).

**Do not run `npx expo start` from the repo root.** Running from root causes the **PlatformConstants could not be found** red screen. The repo is set up so that running Expo from the root will fail (missing App); you must use the mobile folder.

### To fix the PlatformConstants red screen right now

1. **Stop every Expo/Metro process**  
   Close any terminal where you ran `npx expo start` (or `npm start` for Expo), or run:
   ```bash
   lsof -ti:8081 | xargs kill
   lsof -ti:8082 | xargs kill
   ```
2. **On your phone:** fully close Expo Go (remove it from recent apps).
3. **From the repo root**, start the app **only** with:
   ```bash
   npm run mobile
   ```
   (or `./start-mobile.sh`). Wait until the QR code appears.
4. **On your phone:** open Expo Go and scan the **new** QR code from the terminal (the one that just appeared). Do not reuse an old project or URL.
5. If the red screen persists, update Expo Go from the Play Store / App Store, then repeat steps 2–4.# offlineBookieMobile
