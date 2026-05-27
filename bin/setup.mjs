#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  codexResourcePath,
  defaultCodexApp,
  exists,
} from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function runNodeScript(script, args = []) {
  run(process.execPath, [path.join(repoRoot, "bin", script), ...args]);
}

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (!allowFailure && result.status !== 0) {
    const display = [command, ...args].join(" ");
    throw new Error(`Command failed (${result.status ?? "signal"}): ${display}`);
  }

  return result.status === 0;
}

async function codexCliPath() {
  const candidates = [process.env.CODEX_CLI, "codex"].filter(Boolean);
  const bundledCodex = path.join(codexResourcePath(defaultCodexApp), "codex");
  if (await exists(bundledCodex)) candidates.push(bundledCodex);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["plugin", "--help"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const help = `${result.stdout || ""}\n${result.stderr || ""}`;
    if (result.status === 0 && /^\s+add\s/m.test(help) && /^\s+remove\s/m.test(help)) {
      return candidate;
    }
  }

  throw new Error(
    "Could not find a Codex CLI with `codex plugin add/remove` on PATH. " +
      "Install/update Codex CLI or set CODEX_CLI=/path/to/codex.",
  );
}

async function refreshPluginCache() {
  const codex = await codexCliPath();

  // Remove only the local shim so upgrades replace the cached skill copy.
  run(codex, ["plugin", "remove", "browser@codex-browser-share-kit"], {
    allowFailure: true,
  });
  run(codex, ["plugin", "add", "browser@codex-browser-share-kit"]);

  // Chrome may already be installed; keep this best-effort because the config
  // written by install-cli-browser is the source of truth for the MCP runtime.
  run(codex, ["plugin", "add", "chrome@openai-bundled"], {
    allowFailure: true,
  });
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("setup currently supports macOS only.");
  }

  const skipPluginRefresh = process.argv.includes("--skip-plugin-refresh");
  const helperArgs = process.argv.includes("--write-browser-config")
    ? ["--write-config"]
    : [];

  runNodeScript("install-cli-browser.mjs");
  runNodeScript("repair-native-host.mjs");
  runNodeScript("install-local-helper.mjs", helperArgs);

  if (!skipPluginRefresh) {
    await refreshPluginCache();
  }

  runNodeScript("codex-browser-doctor.mjs");

  console.log("");
  console.log("Setup complete. Restart Codex CLI before using @browser.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
