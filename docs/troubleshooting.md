# Troubleshooting

## Run the Doctor

```bash
node ./bin/codex-browser-doctor.mjs
```

Use the first failing line as the next repair step.

## Codex.app Is Not Found

Install Codex.app in `/Applications/Codex.app`, or pass a custom path:

```bash
CODEX_APP="/path/to/Codex.app" node ./bin/codex-browser-doctor.mjs
```

## Chrome Extension Is Missing

The extension ID is `hehggadaopoacecdllhhajmbjkdcmajg`. Install or enable the Codex Chrome extension through Codex/Chrome. This kit does not distribute the extension.

## Native Host Manifest Is Wrong

Repair it:

```bash
node ./bin/repair-native-host.mjs
```

Then restart Chrome.

## Local Helper Is Down

Install or reload it:

```bash
node ./bin/install-local-helper.mjs
```

Manual health check:

```bash
curl http://127.0.0.1:48211/health
```

## CLI Wrapper Is Missing

Create it:

```bash
node ./bin/install-cli-browser.mjs
```

Restart Codex CLI afterwards. Existing CLI sessions do not reload MCP server or plugin config.

## `@browser` Does Not Appear In CLI

Run:

```bash
node ./bin/install-cli-browser.mjs
node ./bin/codex-browser-doctor.mjs
```

Then restart Codex CLI. The repository must be registered as a local marketplace and `browser@codex-browser-share-kit` must be enabled in `~/.codex/config.toml`.
