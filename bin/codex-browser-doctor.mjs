#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  browserClientPath,
  browserPluginPath,
  chromeExtensionId,
  chromePluginPath,
  chromeUserDataDir,
  defaultCodexApp,
  exists,
  extensionHostPath,
  helperPlistPath,
  helperServerPath,
  nativeHostManifestPath,
  nativeHostName,
  nodeReplPath,
  readJson,
  wrapperPath,
} from "./lib.mjs";

const rows = [];

function pass(label, detail = "") {
  rows.push(["PASS", label, detail]);
}

function warn(label, detail = "") {
  rows.push(["WARN", label, detail]);
}

function fail(label, detail = "") {
  rows.push(["FAIL", label, detail]);
}

async function safeJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function listChromeProfiles(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name === "Default" || /^Profile \d+$/.test(name));
  } catch {
    return [];
  }
}

async function extensionStatus() {
  const root = chromeUserDataDir();
  const profiles = await listChromeProfiles(root);
  const installedProfiles = [];
  const enabledProfiles = [];

  for (const profile of profiles) {
    const profilePath = path.join(root, profile);
    const extensionRoot = path.join(profilePath, "Extensions", chromeExtensionId);
    if (await exists(extensionRoot)) installedProfiles.push(profile);

    for (const prefName of ["Secure Preferences", "Preferences"]) {
      const prefs = await safeJson(path.join(profilePath, prefName));
      const settings = prefs?.extensions?.settings?.[chromeExtensionId];
      if (!settings) continue;
      const disabled = settings.state === 0 ||
        (Array.isArray(settings.disable_reasons) && settings.disable_reasons.length > 0) ||
        (typeof settings.disable_reasons === "number" && settings.disable_reasons !== 0);
      if (!disabled) enabledProfiles.push(profile);
      break;
    }
  }

  return { root, profiles, installedProfiles, enabledProfiles };
}

async function helperHealth() {
  try {
    const res = await fetch("http://127.0.0.1:48211/health", {
      signal: AbortSignal.timeout(1000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  if (await exists(defaultCodexApp)) pass("Codex.app", defaultCodexApp);
  else fail("Codex.app", `${defaultCodexApp} not found; set CODEX_APP if installed elsewhere`);

  for (const [label, filePath] of [
    ["Browser plugin", browserPluginPath()],
    ["Chrome plugin", chromePluginPath()],
    ["Browser client", browserClientPath()],
    ["Node REPL", nodeReplPath()],
    ["Chrome extension host", extensionHostPath()],
  ]) {
    if (await exists(filePath)) pass(label, filePath);
    else fail(label, `${filePath} missing`);
  }

  const extension = await extensionStatus();
  if (extension.installedProfiles.length > 0) {
    pass("Chrome extension installed", extension.installedProfiles.join(", "));
  } else {
    fail("Chrome extension installed", `extension ${chromeExtensionId} not found under ${extension.root}`);
  }
  if (extension.enabledProfiles.length > 0) {
    pass("Chrome extension enabled", extension.enabledProfiles.join(", "));
  } else {
    warn("Chrome extension enabled", "not detected; open Chrome Extensions and enable the Codex extension");
  }

  const nativeManifest = nativeHostManifestPath();
  if (await exists(nativeManifest)) {
    const manifest = await readJson(nativeManifest).catch(() => null);
    const expectedOrigin = `chrome-extension://${chromeExtensionId}/`;
    const manifestOk = manifest?.name === nativeHostName &&
      manifest?.path === extensionHostPath() &&
      Array.isArray(manifest?.allowed_origins) &&
      manifest.allowed_origins.includes(expectedOrigin);
    if (manifestOk) pass("Native Messaging manifest", nativeManifest);
    else fail("Native Messaging manifest", `run: node ./bin/repair-native-host.mjs`);
  } else {
    fail("Native Messaging manifest", `run: node ./bin/repair-native-host.mjs`);
  }

  if (await exists(helperServerPath())) pass("Local helper file", helperServerPath());
  else warn("Local helper file", `run: node ./bin/install-local-helper.mjs`);

  if (await exists(helperPlistPath())) pass("Local helper LaunchAgent", helperPlistPath());
  else warn("Local helper LaunchAgent", `run: node ./bin/install-local-helper.mjs`);

  if (await helperHealth()) pass("Local helper health", "http://127.0.0.1:48211/health");
  else warn("Local helper health", `run: node ./bin/install-local-helper.mjs`);

  if (await exists(wrapperPath())) pass("CLI wrapper", wrapperPath());
  else warn("CLI wrapper", `run: node ./bin/write-node-repl-wrapper.mjs`);

  for (const [status, label, detail] of rows) {
    console.log(`${status.padEnd(4)} ${label}${detail ? ` - ${detail}` : ""}`);
  }

  const hasFail = rows.some(([status]) => status === "FAIL");
  process.exitCode = hasFail ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
