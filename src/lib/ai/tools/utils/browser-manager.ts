import type { AnySandbox } from "@/types";
import { isE2BSandbox } from "./sandbox-types";

export interface BrowserActionInput {
  type: "navigate" | "click" | "type" | "press" | "scroll" | "evaluate" | "wait" | "screenshot" | "close";
  url?: string;
  selector?: string;
  text?: string;
  key?: string;
  x?: number;
  y?: number;
  direction?: "up" | "down";
  script?: string;
  ms?: number;
  timeout?: number;
}

export interface BrowserActionResult {
  success: boolean;
  url: string | null;
  title: string | null;
  screenshot: string | null; // base64
  result?: any;
  error?: string;
}

export class BrowserManager {
  private static controllerScript = `
const fs = require('fs');
const path = require('path');
const os = require('os');

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  try {
    const tempDir = os.platform() === 'win32' ? 'C:\\\\temp\\\\ultron-browser' : '/tmp/ultron-browser';
    playwright = require(path.join(tempDir, 'node_modules', 'playwright'));
  } catch (err) {
    console.log(JSON.stringify({ 
      success: false, 
      error: "Playwright not installed", 
      needsInstall: true 
    }));
    process.exit(0);
  }
}

const { chromium } = playwright;

async function run() {
  const args = process.argv.slice(2);
  const actionJson = args[0];
  if (!actionJson) {
    console.log(JSON.stringify({ success: false, error: "No action JSON provided" }));
    process.exit(1);
  }

  let action;
  try {
    action = JSON.parse(actionJson);
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: "Invalid JSON: " + e.message }));
    process.exit(1);
  }

  const wsFilePath = os.platform() === 'win32' ? 'C:\\\\temp\\\\browser-ws.txt' : '/tmp/browser-ws.txt';
  if (!fs.existsSync(wsFilePath)) {
    console.log(JSON.stringify({ success: false, error: "Browser server not running", needsStartServer: true }));
    process.exit(0);
  }

  const wsEndpoint = fs.readFileSync(wsFilePath, 'utf8').trim();
  if (!wsEndpoint) {
    console.log(JSON.stringify({ success: false, error: "Browser WS endpoint file is empty", needsStartServer: true }));
    process.exit(0);
  }

  let browser;
  try {
    browser = await chromium.connect(wsEndpoint);
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: "Failed to connect to browser server: " + e.message, needsStartServer: true }));
    process.exit(0);
  }

  try {
    let contexts = browser.contexts();
    let context = contexts[0];
    if (!context) {
      context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
      });
    }
    let pages = context.pages();
    let page = pages[0];
    if (!page) {
      page = await context.newPage();
    }

    let actionResult = null;

    switch (action.type) {
      case 'navigate':
        await page.goto(action.url, { waitUntil: 'load', timeout: 30000 });
        break;
      case 'click':
        if (action.selector) {
          await page.click(action.selector, { timeout: 10000 });
        } else if (action.x !== undefined && action.y !== undefined) {
          await page.mouse.click(action.x, action.y);
        } else {
          throw new Error("Click requires either selector or x/y coordinates");
        }
        break;
      case 'type':
        if (!action.selector) throw new Error("Type requires selector");
        await page.fill(action.selector, action.text, { timeout: 10000 });
        break;
      case 'press':
        if (!action.selector) throw new Error("Press requires selector");
        await page.press(action.selector, action.key, { timeout: 10000 });
        break;
      case 'scroll':
        const distance = action.direction === 'up' ? -500 : 500;
        await page.evaluate((d) => window.scrollBy(0, d), distance);
        break;
      case 'evaluate':
        if (!action.script) throw new Error("Evaluate requires script");
        actionResult = await page.evaluate(action.script);
        break;
      case 'wait':
        if (action.selector) {
          await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
        } else if (action.ms) {
          await page.waitForTimeout(action.ms);
        } else {
          await page.waitForTimeout(2000);
        }
        break;
      case 'screenshot':
        break;
      case 'close':
        await page.close();
        break;
      default:
        throw new Error("Unknown action type: " + action.type);
    }

    pages = context.pages();
    page = pages[0];
    let screenshotBase64 = null;
    let currentUrl = null;
    let pageTitle = null;

    if (page && !page.isClosed()) {
      const screenshotBuf = await page.screenshot({ type: 'png' });
      screenshotBase64 = screenshotBuf.toString('base64');
      currentUrl = page.url();
      pageTitle = await page.title();
    }

    console.log(JSON.stringify({
      success: true,
      url: currentUrl,
      title: pageTitle,
      screenshot: screenshotBase64,
      result: actionResult
    }));

  } catch (err) {
    console.log(JSON.stringify({
      success: false,
      error: err.message,
      stack: err.stack
    }));
  } finally {
    if (browser) {
      await browser.disconnect().catch(() => {});
    }
  }
}

run();
  `;

  private static serverScript = `
const fs = require('fs');
const path = require('path');
const os = require('os');

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  try {
    const tempDir = os.platform() === 'win32' ? 'C:\\\\temp\\\\ultron-browser' : '/tmp/ultron-browser';
    playwright = require(path.join(tempDir, 'node_modules', 'playwright'));
  } catch (err) {
    console.error("Playwright not found:", err);
    process.exit(1);
  }
}

const { chromium } = playwright;

async function launch() {
  const wsFilePath = os.platform() === 'win32' ? 'C:\\\\temp\\\\browser-ws.txt' : '/tmp/browser-ws.txt';
  try {
    const server = await chromium.launchServer({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const wsEndpoint = server.wsEndpoint();
    fs.writeFileSync(wsFilePath, wsEndpoint);
    console.log('Browser server launched at:', wsEndpoint);
    
    await new Promise(() => {});
  } catch (err) {
    console.error('Failed to launch browser server:', err);
    process.exit(1);
  }
}
launch();
  `;

  constructor(private sandbox: AnySandbox) {}

  private isWindows(): boolean {
    if (isE2BSandbox(this.sandbox)) {
      return false;
    }
    return (this.sandbox as any).isWindows?.() || false;
  }

  private getPaths() {
    const isWin = this.isWindows();
    return {
      controllerPath: isWin ? "C:\\temp\\browser-controller.js" : "/tmp/browser-controller.js",
      serverPath: isWin ? "C:\\temp\\browser-server.js" : "/tmp/browser-server.js",
      wsPath: isWin ? "C:\\temp\\browser-ws.txt" : "/tmp/browser-ws.txt",
      tempDir: isWin ? "C:\\temp\\ultron-browser" : "/tmp/ultron-browser",
    };
  }

  async ensureScriptsWritten(): Promise<void> {
    await this.sandbox.files.write("/tmp/browser-controller.js", BrowserManager.controllerScript);
    await this.sandbox.files.write("/tmp/browser-server.js", BrowserManager.serverScript);
  }

  async installPlaywright(): Promise<void> {
    const { tempDir } = this.getPaths();
    const isWin = this.isWindows();

    if (isWin) {
      await this.sandbox.commands.run(`mkdir "${tempDir}" 2>nul || (exit 0)`, { displayName: "Creating temp directory" });
      await this.sandbox.commands.run(`cd "${tempDir}" && npm init -y`, { displayName: "Initializing package.json" });
      await this.sandbox.commands.run(`cd "${tempDir}" && npm install playwright@1.60.0`, { displayName: "Installing Playwright dependency" });
      await this.sandbox.commands.run(`cd "${tempDir}" && npx playwright install chromium`, { displayName: "Installing Chromium browser" });
    } else {
      await this.sandbox.commands.run(`mkdir -p "${tempDir}"`, { displayName: "Creating temp directory" });
      await this.sandbox.commands.run(`cd "${tempDir}" && npm init -y`, { displayName: "Initializing package.json" });
      await this.sandbox.commands.run(`cd "${tempDir}" && npm install playwright@1.60.0`, { displayName: "Installing Playwright dependency" });
      
      // On E2B/Linux, we use sudo --with-deps to satisfy apt packages if needed
      await this.sandbox.commands.run(`cd "${tempDir}" && sudo npx playwright install --with-deps chromium`, { displayName: "Installing Chromium browser with system dependencies" });
    }
  }

  async startBrowserServer(): Promise<void> {
    const { serverPath } = this.getPaths();
    
    // Clear ws.txt if it exists to ensure we don't read old endpoint
    const { wsPath } = this.getPaths();
    const isWin = this.isWindows();
    if (isWin) {
      await this.sandbox.commands.run(`del /f /q "${wsPath}" 2>nul || (exit 0)`, { displayName: "" });
    } else {
      await this.sandbox.commands.run(`rm -f "${wsPath}"`, { displayName: "" });
    }

    // Launch server in background
    await this.sandbox.commands.run(`node "${serverPath}"`, {
      background: true,
      displayName: "Starting background browser server",
    });

    // Wait for the WS file to be written (up to 15 seconds)
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const checkCmd = isWin 
        ? `if exist "${wsPath}" (echo YES) else (echo NO)`
        : `[ -f "${wsPath}" ] && echo YES || echo NO`;

      const checkRes = await this.sandbox.commands.run(checkCmd, { displayName: "" });
      if (checkRes.stdout.trim().includes("YES")) {
        // Read file contents to make sure it's fully written
        const catCmd = isWin ? `type "${wsPath}"` : `cat "${wsPath}"`;
        const catRes = await this.sandbox.commands.run(catCmd, { displayName: "" });
        if (catRes.stdout.trim().startsWith("ws://") || catRes.stdout.trim().startsWith("wss://")) {
          return;
        }
      }
    }

    throw new Error("Timeout waiting for browser server to write WS endpoint file.");
  }

  async executeAction(action: BrowserActionInput): Promise<BrowserActionResult> {
    const { controllerPath } = this.getPaths();
    
    // Write scripts first to verify they are fresh
    await this.ensureScriptsWritten();

    const actionJsonString = JSON.stringify(action);
    // Double escape quotes for cmd.exe if Windows
    const isWin = this.isWindows();
    const escapedJson = isWin 
      ? actionJsonString.replace(/"/g, '""')
      : actionJsonString;

    const command = isWin
      ? `node "${controllerPath}" "${escapedJson}"`
      : `node "${controllerPath}" '${actionJsonString}'`;

    const res = await this.sandbox.commands.run(command, {
      displayName: `Executing browser action: ${action.type}`,
    });

    try {
      const output = JSON.parse(res.stdout.trim());
      
      if (output.needsInstall) {
        await this.installPlaywright();
        // Retry execution after installation
        return this.executeAction(action);
      }

      if (output.needsStartServer) {
        await this.startBrowserServer();
        // Retry execution after starting server
        return this.executeAction(action);
      }

      return output as BrowserActionResult;
    } catch (e) {
      return {
        success: false,
        url: null,
        title: null,
        screenshot: null,
        error: `Failed to parse controller output: ${res.stdout}\nStderr: ${res.stderr}\nError: ${(e as Error).message}`,
      };
    }
  }

  async close(): Promise<void> {
    const { wsPath } = this.getPaths();
    const isWin = this.isWindows();
    
    const catCmd = isWin ? `type "${wsPath}"` : `cat "${wsPath}"`;
    const checkCmd = isWin 
      ? `if exist "${wsPath}" (echo YES) else (echo NO)`
      : `[ -f "${wsPath}" ] && echo YES || echo NO`;

    const checkRes = await this.sandbox.commands.run(checkCmd, { displayName: "" });
    if (!checkRes.stdout.trim().includes("YES")) {
      return;
    }

    const catRes = await this.sandbox.commands.run(catCmd, { displayName: "" });
    const wsEndpoint = catRes.stdout.trim();
    if (!wsEndpoint) return;

    // Send a close script or just kill node browser-server.js
    // Killing process is easier and clean
    const killCmd = isWin
      ? `wmic process where "CommandLine like '%browser-server.js%'" call terminate 2>nul || taskkill /f /im node.exe /fi "WINDOWTITLE eq Browser Server" 2>nul || (exit 0)`
      : `pkill -f browser-server.js || true`;

    await this.sandbox.commands.run(killCmd, { displayName: "Shutting down browser server" });
    
    if (isWin) {
      await this.sandbox.commands.run(`del /f /q "${wsPath}" 2>nul || (exit 0)`, { displayName: "" });
    } else {
      await this.sandbox.commands.run(`rm -f "${wsPath}"`, { displayName: "" });
    }
  }
}
