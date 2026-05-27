# Codex Browser Share Kit

This repository packages the local glue needed to make Codex Browser/Chrome integration work on another Mac. It intentionally does **not** redistribute OpenAI's bundled Browser plugin, Chrome plugin, native host binary, or Chrome extension.

The kit assumes the recipient has:

- macOS. The installer scripts in this repository currently target macOS.
- Codex.app installed in `/Applications/Codex.app`
- Codex CLI on the same machine, using the same Codex app resources/plugins
- Google Chrome installed
- The Codex Chrome extension installed in the Chrome profile they use
- Node.js 18 or newer

## Can This Install `@browser` Into Codex CLI?

It can make `@browser` usable from CLI-side Codex **when the OpenAI bundled Browser/Chrome plugins are already present on that machine through Codex.app**.

This repository does not install or redistribute OpenAI's proprietary Browser/Chrome binaries. It installs a local `browser@codex-browser-share-kit` shim plus the support pieces that connect Codex CLI to the Browser/Chrome resources already present in Codex.app:

- Chrome Native Messaging manifest
- local Chrome window helper
- Codex CLI `node_repl` MCP wrapper with the correct local trusted Browser/Chrome client hashes
- Chrome extension socket proxy for CLI sessions
- local plugin marketplace/config entries
- diagnostics for the Codex.app plugins and Chrome extension

If a recipient's Codex CLI does not expose plugin support, does not include the Browser/Chrome bundled plugins, or is not paired with Codex.app resources, this kit cannot add `@browser` by itself.

## Why This Exists

The working local setup uses several moving parts:

- OpenAI bundled Browser plugin inside Codex.app
- OpenAI bundled Chrome plugin inside Codex.app
- Chrome extension ID `hehggadaopoacecdllhhajmbjkdcmajg`
- Native Messaging host `com.openai.codexextension`
- A small local helper service for creating Chrome windows from automation
- An optional `codex-node-repl-chrome` wrapper that enables the Chrome backend for CLI-side use

Only the shim, helper, diagnostics, and local config repair scripts are included here. Proprietary files stay on each user's machine as part of their own Codex.app / Chrome installation.

## Quick Start

1. Install or enable the Codex Chrome extension in the Chrome profile you use.
2. Clone this repository and run setup:

```bash
git clone <this-repo-url>
cd codex-browser-share-kit
node ./bin/setup.mjs
```

If the setup doctor reports that the Codex Chrome extension is missing or disabled, install or enable it from Codex/Chrome first, then run `node ./bin/setup.mjs` again. This repository cannot ship that extension.

Restart Codex CLI after setup. Existing CLI sessions do not reload plugin, marketplace, feature, or MCP server config.

Optional safe browser prompt config:

```bash
node ./bin/setup.mjs --write-browser-config
```

## What Gets Installed

`install-local-helper.mjs` writes:

- `~/.codex/local/browser-helper/server.mjs`
- `~/Library/LaunchAgents/io.github.codex-browser-share-kit.helper.plist`
- helper logs in `~/.codex/local/browser-helper/`

The helper listens only on `127.0.0.1:48211` and exposes:

- `GET /health`
- `POST /chrome/new-window`
- `POST /chrome/open-url`

`repair-native-host.mjs` writes or repairs:

- `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json`

It points at the native host binary already installed inside Codex.app:

- `/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/extension-host/macos/arm64/extension-host`

`write-node-repl-wrapper.mjs` writes a standalone wrapper:

- `~/.local/bin/codex-node-repl-chrome`

It computes the trusted Browser client SHA from the recipient's local Codex.app instead of hard-coding your machine's hash.

`install-cli-browser.mjs` writes or updates:

- this repository as a local marketplace: `[marketplaces.codex-browser-share-kit]`
- a local OpenAI bundled marketplace shim in `~/.codex/.tmp/bundled-marketplaces/openai-bundled`
- `browser@codex-browser-share-kit` and `chrome@openai-bundled` plugin enablement
- `features.plugins`, `features.browser_use`, `features.in_app_browser`, and `features.js_repl`
- the `mcp_servers.node_repl` entry needed by the `@browser` skill
- `~/.codex/bin/node_repl_chrome_native_wrapper`
- `~/.codex/bin/codex_browser_pipe_proxy.mjs`

It backs up `~/.codex/config.toml` before changing it.

`setup.mjs` runs the required installers in order:

- `install-cli-browser.mjs`
- `repair-native-host.mjs`
- `install-local-helper.mjs`
- `codex plugin remove/add browser@codex-browser-share-kit` to refresh the local skill cache
- `codex plugin add chrome@openai-bundled` as a best-effort install
- `codex-browser-doctor.mjs`

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
- Codex CLI was not restarted after setup

See [docs/troubleshooting.md](docs/troubleshooting.md).
