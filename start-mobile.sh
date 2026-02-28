#!/bin/bash
# Run the Expo app from the mobile folder (fixes PlatformConstants error).
# Uses port 8082 so it doesn't conflict with Expo running from repo root (8081).
# Usage: ./start-mobile.sh   or   npm run mobile
cd "$(dirname "$0")/mobile" && npx expo start --clear --port 8082
