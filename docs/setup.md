# YouTube Discord Presence Setup

## Requirements

- Windows
- Firefox
- Discord Desktop running locally
- Node.js 22 or newer
- A Discord application client ID

## Discord Application

1. Open the Discord Developer Portal.
2. Create an application for this local integration.
3. Copy its client ID.
4. Set `DISCORD_CLIENT_ID` before running the native host registration script, or edit `packages/native-host/dist/config.json` after registration.

## Build

```sh
npm install
npm run build
```

Or run the Windows one-shot setup, which removes `node_modules`, installs dependencies, builds, and registers the native host:

```powershell
npm run setup:windows
```

## Register Native Host

From a Windows shell with Node on `PATH`:

```sh
npm run install:native:windows
```

This writes a Firefox native messaging manifest and registers it under the current Windows user.
The manifest points to a generated `.bat` launcher, which invokes the built Node native host.
It also creates `packages/native-host/dist/config.json` if it does not already exist.

## Load Firefox Extension

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose "Load Temporary Add-on".
3. Select `packages/extension/dist/manifest.json`.
4. Open a YouTube video and start playback.

## Troubleshooting

- If the popup reports the native host is unavailable, run the native host registration script after `npm run build`.
- If Discord remains disconnected, confirm Discord Desktop is running and `packages/native-host/dist/config.json` contains your Discord application client ID.
- Presence only appears while playback is active. Paused, ended, closed, or navigated-away videos clear the activity.
- Use the extension popup toggle to stop or resume publishing YouTube playback to Discord.
- YouTube is a single-page app, so navigation bugs should be tested by clicking between videos without reloading.
