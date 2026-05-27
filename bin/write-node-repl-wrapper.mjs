#!/usr/bin/env node
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  browserClientPath,
  defaultCodexApp,
  exists,
  nodeReplPath,
  sha256File,
  wrapperPath,
} from "./lib.mjs";

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
  const body = `#!/usr/bin/env bash
export NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S="${hash}"
export NODE_REPL_REQUEST_META='{"x-codex-browser-use-available-backends":["chrome"],"x-codex-browser-use-disable-ambient-network":true}'
export BROWSER_USE_DISABLE_AMBIENT_NETWORK=1
exec "${replPath}" "$@"
`;

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body, "utf8");
  await chmod(target, 0o755);

  console.log(`Wrote ${target}`);
  console.log(`Trusted browser-client SHA256: ${hash}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
