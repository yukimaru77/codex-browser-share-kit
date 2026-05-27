import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const home = os.homedir();
export const defaultCodexApp = process.env.CODEX_APP || "/Applications/Codex.app";
export const chromeExtensionId = "hehggadaopoacecdllhhajmbjkdcmajg";
export const nativeHostName = "com.openai.codexextension";

export function expandHome(filePath) {
  if (filePath === "~") return home;
  if (filePath.startsWith("~/")) return path.join(home, filePath.slice(2));
  return filePath;
}

export async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(filePath) {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function sha256File(filePath) {
  const source = await readFile(filePath);
  return createHash("sha256").update(source).digest("hex");
}

export function codexResourcePath(codexApp = defaultCodexApp) {
  return path.join(codexApp, "Contents", "Resources");
}

export function browserPluginPath(codexApp = defaultCodexApp) {
  return path.join(
    codexResourcePath(codexApp),
    "plugins",
    "openai-bundled",
    "plugins",
    "browser",
  );
}

export function chromePluginPath(codexApp = defaultCodexApp) {
  return path.join(
    codexResourcePath(codexApp),
    "plugins",
    "openai-bundled",
    "plugins",
    "chrome",
  );
}

export function browserClientPath(codexApp = defaultCodexApp) {
  return path.join(browserPluginPath(codexApp), "scripts", "browser-client.mjs");
}

export function nodeReplPath(codexApp = defaultCodexApp) {
  return path.join(codexResourcePath(codexApp), "node_repl");
}

export function extensionHostPath(codexApp = defaultCodexApp) {
  return path.join(
    chromePluginPath(codexApp),
    "extension-host",
    "macos",
    "arm64",
    "extension-host",
  );
}

export function extensionIdJsonPath(codexApp = defaultCodexApp) {
  return path.join(chromePluginPath(codexApp), "scripts", "extension-id.json");
}

export function nativeHostManifestPath() {
  return path.join(
    home,
    "Library",
    "Application Support",
    "Google",
    "Chrome",
    "NativeMessagingHosts",
    `${nativeHostName}.json`,
  );
}

export function chromeUserDataDir() {
  return process.env.CODEX_CHROME_USER_DATA_DIR ||
    path.join(home, "Library", "Application Support", "Google", "Chrome");
}

export function helperRoot() {
  return path.join(home, ".codex", "local", "browser-helper");
}

export function helperServerPath() {
  return path.join(helperRoot(), "server.mjs");
}

export function helperPlistPath() {
  return path.join(home, "Library", "LaunchAgents", "io.github.codex-browser-share-kit.helper.plist");
}

export function wrapperPath() {
  return path.join(home, ".local", "bin", "codex-node-repl-chrome");
}
