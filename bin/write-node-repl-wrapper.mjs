#!/usr/bin/env node
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  browserClientPath,
  codexResourcePath,
  defaultCodexApp,
  exists,
  nodeReplPath,
  sha256File,
  wrapperPath,
} from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function main() {
  const clientPath = browserClientPath(defaultCodexApp);
  const replPath = nodeReplPath(defaultCodexApp);

  if (!(await exists(clientPath))) {
    throw new Error(`Browser client not found: ${clientPath}`);
  }
  if (!(await exists(replPath))) {
    throw new Error(`node_repl not found: ${replPath}`);
  }

  const hash = await sha256File(clientPath);
  const target = wrapperPath();
  const proxyTarget = path.join(path.dirname(target), "codex-browser-pipe-proxy.mjs");
  const proxySocket = "/tmp/codex-browser-use/codex-browser-share-kit-extension.sock";
  const body = `#!/usr/bin/env bash
export NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S="${hash}"
export NODE_REPL_REQUEST_META='{"x-codex-browser-use-available-backends":["chrome","iab"],"x-codex-browser-use-disable-ambient-network":true}'
export BROWSER_USE_DISABLE_AMBIENT_NETWORK=1
export CODEX_BROWSER_USE_PIPE_PATHS="${proxySocket}"
"${path.join(codexResourcePath(defaultCodexApp), "node")}" "${proxyTarget}" >>"$HOME/.codex/chrome_pipe_proxy.log" 2>&1 &
exec "${replPath}" --disable-sandbox "$@"
`;

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(proxyTarget, await readFile(path.join(repoRoot, "helpers", "browser-helper", "pipe-proxy.mjs"), "utf8"), "utf8");
  await chmod(proxyTarget, 0o755);
  await writeFile(target, body, "utf8");
  await chmod(target, 0o755);

  console.log(`Wrote ${target}`);
  console.log(`Wrote ${proxyTarget}`);
  console.log(`Trusted browser-client SHA256: ${hash}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
