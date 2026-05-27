#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { createConnection, createServer } from "node:net";
import { promisify } from "node:util";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const socketDir = "/tmp/codex-browser-use";
const proxySocket = `${socketDir}/codex-browser-share-kit-extension.sock`;
const extensionId = "hehggadaopoacecdllhhajmbjkdcmajg";
const helperUrl = "http://127.0.0.1:48211/chrome/new-window";
const chromeExecutablePath =
  process.env.CODEX_BROWSER_HELPER_CHROME_EXECUTABLE ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromeUserDataDirEnv = "CODEX_CHROME_USER_DATA_DIR";
const chromePreferencesPathEnv = "CODEX_CHROME_PREFERENCES_PATH";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function socketAccepts(path) {
  return await new Promise((resolve) => {
    const socket = createConnection(path);
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 250);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function openChromeWindow() {
  try {
    const res = await fetch(helperUrl, { method: "POST", signal: AbortSignal.timeout(2000) });
    if (res.ok) return;
  } catch {
    // Fall back to launching Chrome directly below.
  }

  launchChromeWindow();
}

function resolveChromeUserDataDirectory() {
  if (process.env[chromeUserDataDirEnv]) {
    return path.resolve(process.env[chromeUserDataDirEnv]);
  }

  return path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Google",
    "Chrome",
  );
}

function readJsonFileIfPresent(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function isUsableChromeProfile(userDataDirectory, profileDirectory) {
  return (
    typeof profileDirectory === "string" &&
    profileDirectory.length > 0 &&
    existsSync(path.join(userDataDirectory, profileDirectory, "Preferences"))
  );
}

function chromeProfileDirectorySortKey(profileDirectory) {
  if (profileDirectory === "Default") return 0;

  const match = profileDirectory.match(/^Profile (\d+)$/);
  if (!match) return -1;
  return Number(match[1]);
}

function chooseLatestUsableChromeProfile(userDataDirectory, profileDirectories) {
  return profileDirectories
    .filter((profileDirectory) => {
      return isUsableChromeProfile(userDataDirectory, profileDirectory);
    })
    .sort((first, second) => {
      return (
        chromeProfileDirectorySortKey(first) -
        chromeProfileDirectorySortKey(second)
      );
    })
    .at(-1);
}

function resolveChromeProfileDirectoryFromLocalState(userDataDirectory) {
  const localState = readJsonFileIfPresent(path.join(userDataDirectory, "Local State"));
  const profile = localState?.profile;
  if (!profile || typeof profile !== "object") return null;

  if (isUsableChromeProfile(userDataDirectory, profile.last_used)) {
    return profile.last_used;
  }

  if (Array.isArray(profile.last_active_profiles)) {
    const activeProfile = chooseLatestUsableChromeProfile(
      userDataDirectory,
      profile.last_active_profiles,
    );
    if (activeProfile) return activeProfile;
  }

  return null;
}

function findLatestChromeProfile(userDataDirectory) {
  const profileDirectories = readdirSync(userDataDirectory, { withFileTypes: true })
    .filter((entry) => {
      return (
        entry.isDirectory() &&
        (entry.name === "Default" || /^Profile \d+$/.test(entry.name))
      );
    })
    .map((entry) => entry.name);

  return chooseLatestUsableChromeProfile(userDataDirectory, profileDirectories);
}

function resolveChromeProfileDirectory() {
  if (process.env[chromePreferencesPathEnv]) {
    return path.basename(path.dirname(path.resolve(process.env[chromePreferencesPathEnv])));
  }

  const userDataDirectory = resolveChromeUserDataDirectory();
  const localStateProfile =
    resolveChromeProfileDirectoryFromLocalState(userDataDirectory);
  if (localStateProfile) return localStateProfile;

  const latestProfile = findLatestChromeProfile(userDataDirectory);
  if (latestProfile) return latestProfile;

  throw new Error(
    `Could not find a Chrome profile directory with Preferences in ${userDataDirectory}.`,
  );
}

function launchChromeWindow() {
  if (!existsSync(chromeExecutablePath)) {
    throw new Error(`Chrome executable does not exist: ${chromeExecutablePath}`);
  }

  const profileDirectory = resolveChromeProfileDirectory();
  const child = spawn(
    chromeExecutablePath,
    [`--profile-directory=${profileDirectory}`, "--new-window", "about:blank"],
    { detached: true, stdio: "ignore" },
  );
  child.unref();
}

async function listExtensionSockets() {
  const { stdout } = await execFileAsync("/usr/sbin/lsof", ["-n", "-U"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  return stdout
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[0] === "extension")
    .map((parts) => parts.at(-1))
    .filter((path) => typeof path === "string" && path.startsWith(`${socketDir}/`) && path.endsWith(".sock"))
    .filter((path) => path !== proxySocket);
}

async function latestExtensionSocket() {
  const started = Date.now();
  let openedChrome = false;

  while (Date.now() - started < 15000) {
    const sockets = await listExtensionSockets().catch(() => []);
    if (sockets.length > 0) return sockets.at(-1);

    if (!openedChrome) {
      openedChrome = true;
      await openChromeWindow().catch(() => {});
    }
    await sleep(250);
  }

  throw new Error("Chrome extension host socket was not found");
}

async function start() {
  await mkdir(socketDir, { recursive: true });

  if (await socketAccepts(proxySocket)) return;
  await rm(proxySocket, { force: true });

  const server = createServer(async (client) => {
    let upstream;
    try {
      upstream = createConnection(await latestExtensionSocket());
      upstream.once("error", (error) => client.destroy(error));
      client.once("error", (error) => upstream.destroy(error));
      upstream.pipe(client);
      client.pipe(upstream);
    } catch (error) {
      client.destroy(error instanceof Error ? error : new Error(String(error)));
      upstream?.destroy();
    }
  });

  server.listen(proxySocket);
}

start().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
