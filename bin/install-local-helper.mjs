#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  helperPlistPath,
  helperRoot,
  helperServerPath,
  home,
} from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function plistXml(nodePath, serverPath) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>io.github.codex-browser-share-kit.helper</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${serverPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CODEX_BROWSER_HELPER_HOST</key>
    <string>127.0.0.1</string>
    <key>CODEX_BROWSER_HELPER_PORT</key>
    <string>48211</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${helperRoot()}/server.log</string>
  <key>StandardErrorPath</key>
  <string>${helperRoot()}/server.error.log</string>
</dict>
</plist>
`;
}

async function health() {
  try {
    const res = await fetch("http://127.0.0.1:48211/health", {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function maybeWriteBrowserConfig() {
  if (!process.argv.includes("--write-config")) return;

  const unsafe = process.argv.includes("--never-ask");
  const source = path.join(
    repoRoot,
    "templates",
    unsafe ? "browser-config.never-ask.toml" : "browser-config.safe.toml",
  );
  const target = path.join(home, ".codex", "browser", "config.toml");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await readFile(source, "utf8"), "utf8");
  console.log(`Wrote ${target}${unsafe ? " (never-ask template)" : ""}`);
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("install-local-helper currently supports macOS only.");
  }

  const serverSource = path.join(repoRoot, "helpers", "browser-helper", "server.mjs");
  const serverTarget = helperServerPath();
  const plistTarget = helperPlistPath();
  const uid = os.userInfo().uid;

  await mkdir(helperRoot(), { recursive: true });
  await mkdir(path.dirname(plistTarget), { recursive: true });
  await writeFile(serverTarget, await readFile(serverSource, "utf8"), "utf8");
  await chmod(serverTarget, 0o644);
  await writeFile(path.join(helperRoot(), "server.log"), "", { flag: "a" });
  await writeFile(path.join(helperRoot(), "server.error.log"), "", { flag: "a" });

  await writeFile(plistTarget, plistXml(process.execPath, serverTarget), "utf8");

  try {
    execFileSync("launchctl", ["bootout", `gui/${uid}`, plistTarget], { stdio: "ignore" });
  } catch {
    // Not loaded yet.
  }
  execFileSync("launchctl", ["bootstrap", `gui/${uid}`, plistTarget], { stdio: "inherit" });
  execFileSync("launchctl", ["enable", `gui/${uid}/io.github.codex-browser-share-kit.helper`], { stdio: "ignore" });

  await maybeWriteBrowserConfig();

  console.log(`Installed ${serverTarget}`);
  console.log(`Installed ${plistTarget}`);
  console.log((await health()) ? "Helper health: ok" : "Helper health: not ready yet");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
