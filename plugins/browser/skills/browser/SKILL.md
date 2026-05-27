---
name: browser
description: "Browser automation from Codex CLI using the local Codex.app Browser/Chrome resources. Use when the user asks for @browser, browser-use, opening pages, inspecting pages, clicking, typing, screenshots, or testing local web targets from CLI."
---

# Browser

Use this skill for browser automation from Codex CLI. This plugin is a thin shim: it does not contain browser automation binaries. It loads the Browser/Chrome client modules already installed with Codex.app.

## Requirements

- Codex.app is installed at `/Applications/Codex.app`, or the installer wrote equivalent config.
- The Codex Chrome extension is installed and enabled in Chrome.
- The `node_repl` MCP server is available in the current Codex CLI session.

## Runtime

Browser commands run through the Node REPL `js` tool. Use the in-app browser backend when available, and fall back to the Chrome extension backend in CLI sessions.

When using the Chrome extension backend from CLI, do not call `browser.nameSession(...)` before opening a tab. Naming the browser session causes Chrome to place agent-created tabs in a visible tab group. For user-facing "open this page" requests, keep the session anonymous so the page opens as a normal Chrome tab.

For user-facing open-page requests on the Chrome extension backend, `browser.tabs.new()` may still create an agent tab in Chrome's `Codex` tab group. After navigating and verifying the page with @browser, open the final URL as a normal user Chrome tab through the local helper, then close the agent tab:

```js
const finalUrl = await tab.url();
if (globalThis.codexBrowserBackend === "extension" && finalUrl?.startsWith("http")) {
  const res = await fetch("http://127.0.0.1:48211/chrome/open-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: finalUrl }),
  });
  if (!res.ok) throw new Error(`Failed to open normal Chrome tab: ${res.status}`);
  await tab.close();
}
```

First browser cell:

```js
const browserRoot = "/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/browser";
const chromeRoot = "/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/chrome";

async function setupCodexBrowser() {
  if (!globalThis.agent) {
    const mod = await import(`${browserRoot}/scripts/browser-client.mjs`);
    await mod.setupBrowserRuntime({ globals: globalThis });
  }

  await agent.browsers.list();

  try {
    globalThis.browser = await agent.browsers.get("iab");
    globalThis.codexBrowserBackend = "iab";
  } catch {
    const mod = await import(`${chromeRoot}/scripts/browser-client.mjs`);
    await mod.setupBrowserRuntime({ globals: globalThis });
    globalThis.browser = await agent.browsers.get("extension");
    globalThis.codexBrowserBackend = "extension";
  }

  if (typeof tab === "undefined" || !globalThis.tab) {
    globalThis.tab = await browser.tabs.new();
  }
}

await setupCodexBrowser();
```

Then navigate:

```js
await tab.goto("https://example.com");
await tab.playwright.waitForLoadState({ state: "domcontentloaded", timeoutMs: 15000 });
nodeRepl.write(JSON.stringify({ title: await tab.title(), url: await tab.url() }));
```

## Notes

- For local web apps, use `http://localhost:<port>` or `http://127.0.0.1:<port>`.
- After any navigation, click, type, or scroll, inspect the page with a DOM snapshot or screenshot before continuing.
- Do not satisfy explicit `@browser` requests with shell commands such as `open -a` when the Browser backend is unavailable. Report the Browser error instead so the CLI integration can be fixed.
- Do not submit forms, upload files, install software, change permissions, or transmit sensitive data unless the user explicitly approved that exact action.
