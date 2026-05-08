# YouTube Discord Presence

Firefox WebExtension plus local Node native host for showing the currently playing YouTube video in Discord Rich Presence.

## Workspace

- `packages/shared`: TypeScript message contracts and validation.
- `packages/extension`: Firefox extension content/background/popup code.
- `packages/native-host`: Firefox native messaging host and Discord IPC client.
- `scripts`: Windows native host registration helpers.

## Commands

```sh
npm install
npm run typecheck
npm test
npm run build
```

On Windows, use the one-shot setup script:

```powershell
npm run setup:windows
```

See [docs/setup.md](docs/setup.md) for local Windows setup.
