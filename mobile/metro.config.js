// Ensures Metro uses this folder as project root when you run `npx expo start` from mobile/.
// Stops Metro from using the repo root (which causes ../../App and /offlineGame2/assets errors).
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

module.exports = config;
