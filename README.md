# Codex Browser Share Kit

This repository packages the local glue needed to make Codex Browser/Chrome integration work on another Mac. It intentionally does **not** redistribute OpenAI's bundled Browser plugin, Chrome plugin, native host binary, or Chrome extension.

The kit assumes the recipient has:

- Codex.app installed in `/Applications/Codex.app`
- Google Chrome installed
- The Codex Chrome extension installed in the Chrome profile they use
- Node.js 18 or newer

## Why This Exists

The working local setup uses several moving parts:

- OpenAI bundled Browser plugin inside Codex.app
- OpenAI bundled Chrome plugin inside Codex.app
- Chrome extension ID `hehggadaopoacecdllhhajmbjkdcmajg`
- Native Messaging host `com.openai.codexextension`
- A small local helper service for creating Chrome windows from automation
- An optional `codex-node-repl-chrome` wrapper that enables the Chrome backend for CLI-side use

Only the helper, diagnostics, and local config repair scripts are included here. Proprietary files stay on each user's machine as part of their own Codex.app / Chrome installation.

## Quick Start

```bash
git clone <this-repo-url>
cd codex-browser-share-kit

node ./bin/codex-browser-doctor.mjs
node ./bin/repair-native-host.mjs
node ./bin/install-local-helper.mjs
node ./bin/write-node-repl-wrapper.mjs
node ./bin/codex-browser-doctor.mjs
```

If the doctor reports that the Codex Chrome extension is missing or disabled, install or enable it from Codex/Chrome first. This repository cannot ship that extension.

## What Gets Installed

`install-local-helper.mjs` writes:

- `~/.codex/local/browser-helper/server.mjs`
- `~/Library/LaunchAgents/io.github.codex-browser-share-kit.helper.plist`
- helper logs in `~/.codex/local/browser-helper/`

The helper listens only on `127.0.0.1:48211` and exposes:

- `GET /health`
- `POST /chrome/new-window`

`repair-native-host.mjs` writes or repairs:

- `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json`

It points at the native host binary already installed inside Codex.app:

- `/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/extension-host/macos/arm64/extension-host`

`write-node-repl-wrapper.mjs` writes:

- `~/.local/bin/codex-node-repl-chrome`

It computes the trusted Browser client SHA from the recipient's local Codex.app instead of hard-coding your machine's hash.

## Optional Browser Config

Safe default:

```bash
mkdir -p ~/.codex/browser
cp templates/browser-config.safe.toml ~/.codex/browser/config.toml
```

Your local machine used a no-prompt config. That is included only as an explicit opt-in template:

```bash
cp templates/browser-config.never-ask.toml ~/.codex/browser/config.toml
```

Use the no-prompt template only on a trusted development machine.

## Distribution Boundary

Do not add these files to this repository:

- `/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/browser`
- `/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/chrome`
- Chrome extension directory `hehggadaopoacecdllhhajmbjkdcmajg`
- `extension-host` binary
- `node_repl` binary
- Any copied/minified/decompiled extension source from Chrome's profile

Those are third-party/proprietary artifacts. This repository only documents expected paths and repairs local user-owned configuration.

## Troubleshooting

Run:

```bash
node ./bin/codex-browser-doctor.mjs
```

Most failures are one of:

- Codex.app is missing or installed somewhere else
- Chrome extension is not installed in the active Chrome profile
- Native Messaging manifest points to an old Codex.app path
- Local helper LaunchAgent is not loaded
- `~/.local/bin` is not on `PATH`

See [docs/troubleshooting.md](docs/troubleshooting.md).
