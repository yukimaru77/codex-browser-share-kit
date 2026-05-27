# Troubleshooting

## Run the Doctor

```bash
node ./bin/codex-browser-doctor.mjs
```

Use the first failing line as the next repair step.

For a full reinstall after cloning or pulling updates, run:

```bash
node ./bin/setup.mjs
```

This rewrites the CLI config, repairs the native host manifest, reloads the local helper, refreshes the local `browser@codex-browser-share-kit` plugin cache, and then runs the doctor.

## Codex.app Is Not Found

Install Codex.app in `/Applications/Codex.app`, or pass a custom path:

```bash
CODEX_APP="/path/to/Codex.app" node ./bin/codex-browser-doctor.mjs
```

## Chrome Extension Is Missing

The extension ID is `hehggadaopoacecdllhhajmbjkdcmajg`. Install or enable the Codex Chrome extension through Codex/Chrome. This kit does not distribute the extension.

After installing or enabling the extension, run:

```bash
node ./bin/setup.mjs
```

## Native Host Manifest Is Wrong

Repair it:

```bash
node ./bin/repair-native-host.mjs
```

Then restart Chrome.

`node ./bin/setup.mjs` also runs this repair step.

## Local Helper Is Down

Install or reload it:

```bash
node ./bin/install-local-helper.mjs
```

Manual health check:

```bash
curl http://127.0.0.1:48211/health
```

The helper also exposes `POST /chrome/open-url`, used by the Browser skill to hand verified URLs off to a normal Chrome tab.

## CLI Wrapper Is Missing

Create it:

```bash
node ./bin/install-cli-browser.mjs
```

Restart Codex CLI afterwards. Existing CLI sessions do not reload MCP server or plugin config.

`node ./bin/setup.mjs` creates the wrapper and refreshes the local plugin cache.

## `@browser` Does Not Appear In CLI

Run:

```bash
node ./bin/setup.mjs
```

Then restart Codex CLI. The repository must be registered as a local marketplace, `browser@codex-browser-share-kit` must be installed/enabled, and `mcp_servers.node_repl` must point at the generated wrapper.

## Chrome Shows The Profile Picker

Run setup again so the current helper is installed:

```bash
node ./bin/setup.mjs
```

The helper reads Chrome's last-used profile and launches Chrome with `--profile-directory=<profile>`. That avoids app-level launches that can show the profile picker on machines with multiple Chrome profiles.
