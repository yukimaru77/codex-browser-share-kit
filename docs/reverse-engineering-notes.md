# Reverse Engineering Notes

These notes describe the local integration points that were observed. They are intentionally limited to paths, IDs, and config shape needed for interoperability. Do not copy proprietary binaries or bundled OpenAI plugin source into this repository.

## Observed Components

- Browser plugin:
  - `/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/browser`
  - local cache: `~/.codex/plugins/cache/openai-bundled/browser/<version>`
- Chrome plugin:
  - `/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/chrome`
  - local cache: `~/.codex/plugins/cache/openai-bundled/chrome/<version>`
- Chrome extension:
  - extension ID: `hehggadaopoacecdllhhajmbjkdcmajg`
  - observed profile path: `~/Library/Application Support/Google/Chrome/<Profile>/Extensions/hehggadaopoacecdllhhajmbjkdcmajg`
- Native Messaging host:
  - host name: `com.openai.codexextension`
  - manifest path: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json`
  - host binary path inside Codex.app: `.../plugins/chrome/extension-host/macos/arm64/extension-host`
- Node REPL wrapper:
  - simple wrapper path: `~/.local/bin/codex-node-repl-chrome`
  - CLI MCP wrapper path: `~/.codex/bin/node_repl_chrome_native_wrapper`
  - important env:
    - `NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S`
    - `NODE_REPL_TRUSTED_CODE_PATHS`
    - `NODE_REPL_REQUEST_META`
    - `BROWSER_USE_DISABLE_AMBIENT_NETWORK=1`
- CLI config:
  - local marketplace for this repo: `codex-browser-share-kit`
  - local marketplace shim for bundled plugin resources: `openai-bundled`
  - enabled plugins: `browser@codex-browser-share-kit`, `browser@openai-bundled`, `chrome@openai-bundled`
  - MCP server: `mcp_servers.node_repl`

## Packaging Decision

The bundled Browser/Chrome plugin manifests identify OpenAI as the author and mark the license as proprietary. This repository therefore packages only:

- health checks
- local config installers
- Native Messaging manifest repair
- local helper service
- documentation

The recipient must obtain Codex.app and the Chrome extension through their normal channels.
