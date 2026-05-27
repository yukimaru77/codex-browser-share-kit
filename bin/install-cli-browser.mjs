#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  browserClientPath,
  browserPluginPath,
  chromePluginPath,
  codexResourcePath,
  defaultCodexApp,
  exists,
  home,
  sha256File,
} from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const codexHome = process.env.CODEX_HOME || path.join(home, ".codex");
const configPath = path.join(codexHome, "config.toml");
const bundledMarketplaceRoot = path.join(codexHome, ".tmp", "bundled-marketplaces", "openai-bundled");
const wrapperPath = path.join(codexHome, "bin", "node_repl_chrome_native_wrapper");

function quote(value) {
  return JSON.stringify(value);
}

function array(values) {
  return `[${values.map(quote).join(", ")}]`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertTomlKey(content, table, key, value) {
  const header = `[${table}]`;
  const headerRe = new RegExp(`^${escapeRegex(header)}\\s*$`, "m");
  const match = headerRe.exec(content);
  const line = `${key} = ${value}`;

  if (!match) {
    const prefix = content.endsWith("\n") || content.length === 0 ? "" : "\n";
    return `${content}${prefix}\n${header}\n${line}\n`;
  }

  const start = match.index + match[0].length;
  const nextHeaderRe = /^\[[^\]]+\]\s*$/gm;
  nextHeaderRe.lastIndex = start;
  const next = nextHeaderRe.exec(content);
  const end = next ? next.index : content.length;
  const before = content.slice(0, start);
  const body = content.slice(start, end);
  const after = content.slice(end);
  const keyRe = new RegExp(`^(\\s*)${escapeRegex(key)}\\s*=.*$`, "m");

  if (keyRe.test(body)) {
    return before + body.replace(keyRe, `$1${line}`) + after;
  }

  const bodyPrefix = body.startsWith("\n") ? "" : "\n";
  return `${before}${bodyPrefix}${line}${body}${after}`;
}

async function writeNodeReplWrapper() {
  const resources = codexResourcePath(defaultCodexApp);
  const browserHash = await sha256File(browserClientPath(defaultCodexApp));
  const chromeHash = await sha256File(path.join(chromePluginPath(defaultCodexApp), "scripts", "browser-client.mjs"));
  const browserScripts = path.join(browserPluginPath(defaultCodexApp), "scripts");
  const chromeScripts = path.join(chromePluginPath(defaultCodexApp), "scripts");
  const tmpBrowserScripts = path.join(bundledMarketplaceRoot, "plugins", "browser", "scripts");
  const tmpChromeScripts = path.join(bundledMarketplaceRoot, "plugins", "chrome", "scripts");
  const trustedPaths = [browserScripts, chromeScripts, tmpBrowserScripts, tmpChromeScripts].join(":");

  const body = `#!/usr/bin/env bash
set -euo pipefail

codex_runtime="${resources}"
real_node_repl="$codex_runtime/node_repl"
log_file="\${CODEX_HOME:-$HOME/.codex}/node_repl_chrome_native_wrapper.log"

mkdir -p "\${CODEX_HOME:-$HOME/.codex}/tmp" 2>/dev/null || true
export TMPDIR="\${CODEX_HOME:-$HOME/.codex}/tmp"
export CODEX_CLI_PATH="$codex_runtime/codex"
export NODE_REPL_NODE_PATH="$codex_runtime/node"
export NODE_REPL_BROWSER_CLIENT_MARKETPLACE_NAME="\${NODE_REPL_BROWSER_CLIENT_MARKETPLACE_NAME:-openai-bundled}"
export NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS="\${NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS:-15000}"
export NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S="\${NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S:-${browserHash},${chromeHash}}"
export NODE_REPL_TRUSTED_CODE_PATHS="\${NODE_REPL_TRUSTED_CODE_PATHS:-${trustedPaths}}"

log() {
  printf '%s %s\\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >>"$log_file" 2>/dev/null || true
}

detect_chrome_extension_pipes() {
  local pids paths pid
  pids="$(pgrep -f '/chrome/.*/extension-host chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/' 2>/dev/null || true)"
  [[ -n "$pids" ]] || return 0

  paths=""
  for pid in $pids; do
    while IFS= read -r path; do
      [[ -n "$path" ]] || continue
      case ":$paths:" in
        *":$path:"*) ;;
        *) paths="\${paths:+$paths:}$path" ;;
      esac
    done < <(lsof -nU -p "$pid" 2>/dev/null | awk '$1 == "extension" && /\\/tmp\\/codex-browser-use\\/.*\\.sock$/ {print $NF}')
  done

  [[ -n "$paths" ]] || return 0
  export CODEX_BROWSER_USE_PIPE_PATHS="$paths"
  printf '%s' "$paths" >"\${CODEX_HOME:-$HOME/.codex}/chrome_extension_pipes" 2>/dev/null || true
  log "using chrome extension pipe paths=$paths"
}

detect_chrome_extension_pipes
exec "$real_node_repl" "$@"
`;

  await mkdir(path.dirname(wrapperPath), { recursive: true });
  await writeFile(wrapperPath, body, { mode: 0o755 });
}

async function writeBundledMarketplace() {
  const marketplaceDir = path.join(bundledMarketplaceRoot, ".agents", "plugins");
  const pluginsDir = path.join(bundledMarketplaceRoot, "plugins");
  await mkdir(marketplaceDir, { recursive: true });
  await mkdir(pluginsDir, { recursive: true });
  await writeFile(
    path.join(marketplaceDir, "marketplace.json"),
    `${JSON.stringify({
      name: "openai-bundled",
      interface: { displayName: "OpenAI Bundled" },
      plugins: [
        {
          name: "browser",
          source: { source: "local", path: "./plugins/browser" },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
          category: "Engineering",
        },
        {
          name: "chrome",
          source: { source: "local", path: "./plugins/chrome" },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
          category: "Productivity",
        },
      ],
    }, null, 2)}\n`,
  );

  for (const [name, target] of [
    ["browser", browserPluginPath(defaultCodexApp)],
    ["chrome", chromePluginPath(defaultCodexApp)],
  ]) {
    const link = path.join(pluginsDir, name);
    await rm(link, { force: true, recursive: true });
    await symlink(target, link, "dir");
  }
}

async function updateCodexConfig() {
  const resources = codexResourcePath(defaultCodexApp);
  const browserHash = await sha256File(browserClientPath(defaultCodexApp));
  const chromeHash = await sha256File(path.join(chromePluginPath(defaultCodexApp), "scripts", "browser-client.mjs"));
  const trustedPaths = [
    path.join(browserPluginPath(defaultCodexApp), "scripts"),
    path.join(chromePluginPath(defaultCodexApp), "scripts"),
    path.join(bundledMarketplaceRoot, "plugins", "browser", "scripts"),
    path.join(bundledMarketplaceRoot, "plugins", "chrome", "scripts"),
  ].join(":");

  await mkdir(codexHome, { recursive: true });
  let content = (await exists(configPath)) ? await readFile(configPath, "utf8") : "";
  if (content.length > 0) {
    const backup = `${configPath}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await writeFile(backup, content);
    console.log(`Backed up ${configPath} to ${backup}`);
  }

  const writes = [
    ["marketplaces.codex-browser-share-kit", "last_updated", quote(new Date().toISOString())],
    ["marketplaces.codex-browser-share-kit", "source_type", quote("local")],
    ["marketplaces.codex-browser-share-kit", "source", quote(repoRoot)],
    ["marketplaces.openai-bundled", "last_updated", quote(new Date().toISOString())],
    ["marketplaces.openai-bundled", "source_type", quote("local")],
    ["marketplaces.openai-bundled", "source", quote(bundledMarketplaceRoot)],
    ['plugins."browser@codex-browser-share-kit"', "enabled", "true"],
    ['plugins."browser@openai-bundled"', "enabled", "true"],
    ['plugins."chrome@openai-bundled"', "enabled", "true"],
    ["features", "plugins", "true"],
    ["features", "browser_use", "true"],
    ["features", "in_app_browser", "true"],
    ["features", "js_repl", "true"],
    ["mcp_servers.node_repl", "command", quote(path.join(resources, "codex"))],
    [
      "mcp_servers.node_repl",
      "args",
      array([
        "sandbox",
        "-c",
        'sandbox_mode="danger-full-access"',
        "macos",
        "--allow-unix-socket",
        "/tmp/codex-browser-use",
        wrapperPath,
      ]),
    ],
    ["mcp_servers.node_repl.env", "CODEX_CLI_PATH", quote(path.join(resources, "codex"))],
    ["mcp_servers.node_repl.env", "NODE_REPL_BROWSER_CLIENT_MARKETPLACE_NAME", quote("openai-bundled")],
    ["mcp_servers.node_repl.env", "NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS", quote("15000")],
    ["mcp_servers.node_repl.env", "NODE_REPL_NODE_PATH", quote(path.join(resources, "node"))],
    ["mcp_servers.node_repl.env", "NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S", quote(`${browserHash},${chromeHash}`)],
    ["mcp_servers.node_repl.env", "NODE_REPL_TRUSTED_CODE_PATHS", quote(trustedPaths)],
  ];

  for (const [table, key, value] of writes) {
    content = upsertTomlKey(content, table, key, value);
  }

  await writeFile(configPath, content);
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("install-cli-browser currently supports macOS only.");
  }
  for (const required of [
    defaultCodexApp,
    browserPluginPath(defaultCodexApp),
    chromePluginPath(defaultCodexApp),
    browserClientPath(defaultCodexApp),
    path.join(chromePluginPath(defaultCodexApp), "scripts", "browser-client.mjs"),
  ]) {
    if (!(await exists(required))) throw new Error(`Required path not found: ${required}`);
  }

  await writeBundledMarketplace();
  await writeNodeReplWrapper();
  await updateCodexConfig();

  try {
    execFileSync("chmod", ["+x", wrapperPath], { stdio: "ignore" });
  } catch {
    // writeFile mode is enough on normal filesystems.
  }

  console.log(`Installed CLI Browser marketplace from ${repoRoot}`);
  console.log(`Wrote bundled marketplace links at ${bundledMarketplaceRoot}`);
  console.log(`Wrote Node REPL wrapper at ${wrapperPath}`);
  console.log(`Updated ${configPath}`);
  console.log("Restart Codex CLI before testing @browser.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
