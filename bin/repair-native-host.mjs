#!/usr/bin/env node
import { copyFile } from "node:fs/promises";
import {
  chromeExtensionId,
  defaultCodexApp,
  exists,
  extensionHostPath,
  nativeHostManifestPath,
  nativeHostName,
  writeJson,
} from "./lib.mjs";

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("repair-native-host currently supports macOS only.");
  }

  const hostPath = extensionHostPath(defaultCodexApp);
  if (!(await exists(hostPath))) {
    throw new Error(`Codex Chrome native host binary not found: ${hostPath}`);
  }

  const manifestPath = nativeHostManifestPath();
  if (await exists(manifestPath)) {
    await copyFile(manifestPath, `${manifestPath}.bak`);
  }

  await writeJson(manifestPath, {
    allowed_origins: [`chrome-extension://${chromeExtensionId}/`],
    description: "Codex chrome native messaging host",
    name: nativeHostName,
    path: hostPath,
    type: "stdio",
  });

  console.log(`Wrote ${manifestPath}`);
  console.log("Restart Chrome before testing the extension.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
