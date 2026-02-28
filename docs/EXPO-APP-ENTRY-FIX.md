# Expo "Unable to resolve ../../App" – Fix Guide (SDK 54)

## 1. Why this happens

Expo’s default entry is **`node_modules/expo/AppEntry.js`**. That file does:

```js
import App from '../../App';
registerRootComponent(App);
```

So the **project root** is assumed to be **two levels above** `node_modules/expo/`:

- `node_modules/expo/` → one level up → `node_modules/` → one level up → **project root**
- So it looks for **`<project_root>/App`** (e.g. `App.js`, `App.tsx`, etc.).

If you run **`npx expo start`** from **`/Users/Smiti/offlineGame2`**:

- Project root = `offlineGame2`
- Resolved path = `offlineGame2/App` (no extension; Metro tries `.android.tsx`, `.tsx`, `.js`, etc.).

So the error means: **Metro is using `offlineGame2` as the project root and cannot find any `App` file there.** That’s why you see “none of these files exist” for `App(.android.tsx|.tsx|.js|...)`.

Common causes:

- Running Expo from the **repo root** while the real app lives in **`mobile/`**.
- No **`App.js`** (or `App.tsx`) at the directory you’re running Expo from.
- **`package.json`** `"main"` points to **`expo/AppEntry.js`** (so `../../App` is required) but there is no `App` at project root.

---

## 2. Does App.js have to be in the root?

**Only if you keep the default entry.**

- **Default entry** (`"main": "expo/AppEntry.js"`):  
  Yes. **`App` must live at the project root** (the folder where you run `npx expo start`), because `expo/AppEntry.js` resolves `../../App` to that folder.

- **Custom entry** (`"main": "ExpoEntry.js"` or similar):  
  No. Your entry file can import `App` from anywhere (e.g. `./mobile/App`), so **`App.js` does not need to be in the root.**

In this repo we use a **custom entry** at the repo root so that the real app can stay in **`mobile/`**.

---

## 3. Correct folder structure (Expo managed workflow)

Typical **single** Expo app (one folder = one app):

```
my-expo-app/
├── App.js          ← root component (or App.tsx)
├── app.json        (or app.config.js)
├── package.json    ("main": "expo/AppEntry.js" or omitted)
├── assets/
├── src/            (optional)
└── node_modules/
```

Your repo is a **monorepo**; the Expo app lives in **`mobile/`**:

```
offlineGame2/
├── package.json     (root; "main": "ExpoEntry.js" when running Expo from root)
├── ExpoEntry.js    (custom entry when running from root)
├── App.js          (optional re-export for compatibility)
├── mobile/         ← actual Expo app
│   ├── App.js
│   ├── app.json
│   ├── package.json
│   ├── assets/
│   └── src/
├── frontend/
└── ...
```

So:

- **Project root for Expo** = the folder from which you run `npx expo start` (either `offlineGame2` or `offlineGame2/mobile`).
- **`App`** must be at that root **or** you use a custom entry that imports it from somewhere else (e.g. `./mobile/App`).

---

## 4. Correct App.js at project root (when using default entry)

If you use the **default** entry and want **`App` at project root**:

**Root `App.js` (minimal):**

```js
import { registerRootComponent } from 'expo';
import App from './mobile/App';  // or your real app component

export default App;
registerRootComponent(App);
```

Or only re-export (and let `expo/AppEntry.js` call `registerRootComponent`):

```js
export { default } from './mobile/App';
```

In this repo, **`ExpoEntry.js`** is the custom entry and imports **`./mobile/App`**, so **`App.js`** at root is only needed if something still expects `../../App` to exist.

---

## 5. Entry file inside `src/` (e.g. `src/App.js` or `src/index.js`)

You do **not** have to have `App` at project root. Use a **custom entry**:

1. **Create an entry file** at project root, e.g. **`index.js`**:

```js
// index.js (at project root)
import { registerRootComponent } from 'expo';
import App from './src/App';  // or './src/index'

registerRootComponent(App);
```

2. **Point `package.json` to it:**

```json
{
  "main": "index.js"
}
```

Then Metro uses **`index.js`** instead of **`expo/AppEntry.js`**, so **`../../App` is never used** and the error goes away. Your real app can live in **`src/App.js`** or **`src/index.js`**.

---

## 6. `app.json` and `package.json`

- **`package.json` – `"main"`**  
  - Defines the **JS entry**.
  - **Default:** `expo/AppEntry.js` (looks for `../../App` at project root).
  - **Custom:** e.g. `"main": "ExpoEntry.js"` or `"main": "index.js"` so you never depend on `../../App`.

- **`app.json`**  
  - Does **not** set the JS entry.  
  - It configures name, slug, icon, splash, native IDs, etc. No change needed there for this error.

So: **fix the entry in `package.json`** (and optionally add a custom entry file). **`app.json`** does not need to be changed for the “Unable to resolve ../../App” issue.

---

## 7. Clean cache and restart Expo

Run from the **same directory** you use for `npx expo start` (repo root or `mobile/`).

**Option A – from repo root (`offlineGame2`):**

```bash
cd /Users/Smiti/offlineGame2

# Clear Metro / Expo caches
npx expo start --clear

# If it still misbehaves:
rm -rf node_modules/.cache
npx expo start --clear
```

**Option B – from `mobile/` (recommended to avoid PlatformConstants issues):**

```bash
cd /Users/Smiti/offlineGame2/mobile

rm -rf node_modules/.cache
npx expo start --clear
```

**Heavy reset (if needed):**

```bash
cd /Users/Smiti/offlineGame2/mobile
watchman watch-del-all 2>/dev/null || true
rm -rf node_modules/.cache
rm -rf /tmp/metro-*
npx expo start --clear
```

Then press **a** (Android) or **i** (iOS) in the terminal, or scan the QR code with Expo Go.

---

## 8. EAS Build (Android) and preventing this error

For **EAS**, the **project root** is the directory from which you run **`eas build`** (and where **`eas.json`** and **`app.json`** live). To avoid “Unable to resolve ../../App” and keep one clear Expo app:

- **Run EAS from the `mobile/` folder** (so the Expo project root is `mobile/` and **`mobile/App.js`** is the natural `../../App` when using the default entry).

Steps:

1. **Put EAS config in `mobile/`:**

Create **`mobile/eas.json`**:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "apk" }
    }
  },
  "submit": {
    "production": {}
  }
}
```

2. **Build from `mobile/`:**

```bash
cd /Users/Smiti/offlineGame2/mobile
npx eas-cli build --platform android --profile preview
```

(Or `production` if you use that profile.)

3. **No `../../App` in EAS:**  
   Because the project root for the build is **`mobile/`**, the default **`expo/AppEntry.js`** resolves **`../../App`** to **`mobile/App.js`**, which exists. So you don’t need a root-level `App.js` for EAS when you build from **`mobile/`**.

4. **If you ever run EAS from repo root** (not recommended here):  
   You’d need a root **`App.js`** (or a custom entry like **`ExpoEntry.js`**) so that **`../../App`** (or your custom entry) resolves. Prefer running EAS from **`mobile/`** so the structure stays standard.

---

## Summary

| Topic | Answer |
|--------|--------|
| **Why the error** | Default entry `expo/AppEntry.js` imports `../../App`; from repo root that’s `offlineGame2/App`, which wasn’t found. |
| **App at root?** | Only required if you use the default entry; with a custom entry, `App` can be anywhere. |
| **Structure** | One Expo app per folder; here the app is in **`mobile/`**; root uses **`ExpoEntry.js`** when running from root. |
| **Entry in `src/`** | Set **`"main": "index.js"`** and in **`index.js`** do **`registerRootComponent(require('./src/App'))`** (or import from `./src/App`). |
| **app.json / package.json** | Fix **`package.json`** `"main"` (custom entry); **`app.json`** unchanged. |
| **Clean restart** | `npx expo start --clear` from the folder you use as project root; optionally clear `node_modules/.cache` and Metro temp dirs. |
| **EAS** | Run **`eas build`** from **`mobile/`**; add **`mobile/eas.json`**; no need for root `App.js` for EAS. |

Using **`npm run mobile`** (or **`./start-mobile.sh`**) runs Expo from **`mobile/`**, so the default entry and **`mobile/App.js`** work without any root **`App.js`** or **`ExpoEntry.js`**.
