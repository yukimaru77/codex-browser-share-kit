import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const host = process.env.CODEX_BROWSER_HELPER_HOST || "127.0.0.1";
const port = Number.parseInt(process.env.CODEX_BROWSER_HELPER_PORT || "48211", 10);
const chromeAppName = process.env.CODEX_BROWSER_HELPER_CHROME_APP || "Google Chrome";

async function openChromeWindow() {
  const { stdout } = await execFileAsync("/usr/bin/osascript", [
    "-e",
    `tell application "${chromeAppName}" to make new window`,
    "-e",
    `tell application "${chromeAppName}" to set URL of active tab of front window to "about:blank"`,
  ], { encoding: "utf8" });
  return stdout.trim();
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, error: "missing-url" });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && req.url === "/chrome/new-window") {
    try {
      const result = await openChromeWindow();
      sendJson(res, 200, { ok: true, result });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "not-found" });
});

server.listen(port, host, () => {
  process.stdout.write(
    JSON.stringify({ ok: true, host, port, pid: process.pid }) + "\n",
  );
});
