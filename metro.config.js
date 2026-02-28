const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const mobileRoot = path.join(projectRoot, 'mobile');

const config = getDefaultConfig(projectRoot);

// Use only mobile's node_modules so the bundle matches Expo Go (SDK 52).
// Prevents "PlatformConstants could not be found" when running from repo root.
config.resolver.nodeModulesPaths = [
  path.join(mobileRoot, 'node_modules'),
];

config.watchFolders = [mobileRoot];

module.exports = config;
