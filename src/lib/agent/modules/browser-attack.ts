import type { AnySandbox } from "@/types";
import { Finding } from "../ptg";
import { isE2BSandbox } from "../../ai/tools/utils/sandbox-types";
import * as path from "path";

export interface BrowserAttackOptions {
  targetUrl: string;
  payloads?: {
    xss?: string[];
    sqli?: string[];
  };
}

export interface BrowserAttackResult {
  success: boolean;
  findings: Finding[];
  error?: string;
}

export class BrowserAttackAgent {
  private static scannerScript = `
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
      error: "Playwright not installed: " + err.message,
      findings: []
    }));
    process.exit(0);
  }
}

const { chromium } = playwright;

async function run() {
  const args = process.argv.slice(2);
  const targetUrl = args[0];
  if (!targetUrl) {
    console.log(JSON.stringify({ success: false, error: "No target URL provided", findings: [] }));
    process.exit(1);
  }

  const customPayloadsStr = args[1];
  let customPayloads = {};
  if (customPayloadsStr) {
    try {
      customPayloads = JSON.parse(customPayloadsStr);
    } catch(e) {}
  }

  const wsFilePath = os.platform() === 'win32' ? 'C:\\\\temp\\\\browser-ws.txt' : '/tmp/browser-ws.txt';
  let browser;
  if (fs.existsSync(wsFilePath)) {
    const wsEndpoint = fs.readFileSync(wsFilePath, 'utf8').trim();
    if (wsEndpoint) {
      try {
        browser = await chromium.connect(wsEndpoint);
      } catch (e) {
        // Fallback to launching a local instance
      }
    }
  }

  if (!browser) {
    try {
      browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch (err) {
      console.log(JSON.stringify({ success: false, error: "Failed to launch browser: " + err.message, findings: [] }));
      process.exit(1);
    }
  }

  const findings = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();

    // 1. CLICKJACKING TEST
    try {
      const response = await page.goto(targetUrl, { waitUntil: 'load', timeout: 15000 });
      if (response) {
        const headers = response.headers();
        const xFrameOptions = headers['x-frame-options'];
        const csp = headers['content-security-policy'];
        
        let hasClickjackingProtection = false;
        if (xFrameOptions && (xFrameOptions.toLowerCase().includes('deny') || xFrameOptions.toLowerCase().includes('sameorigin'))) {
          hasClickjackingProtection = true;
        }
        if (csp && (csp.toLowerCase().includes('frame-ancestors'))) {
          hasClickjackingProtection = true;
        }

        if (!hasClickjackingProtection) {
          findings.push({
            type: "vulnerability",
            severity: "medium",
            description: "Missing Clickjacking protection headers",
            raw_output: "Headers check: X-Frame-Options and Content-Security-Policy frame-ancestors missing.",
            cve_ids: [],
            cvss_score: 5.0,
            epss_score: 0.01,
            remediation: "Configure X-Frame-Options to DENY or SAMEORIGIN, or Content-Security-Policy with frame-ancestors 'self'.",
            evidence: "HTTP headers checked on: " + targetUrl,
            endpoint: targetUrl,
            validated: true
          });
        }
      }
    } catch (err) {
      // Ignore clickjacking connection error, log it
    }

    // 2. CSRF & FORM DETECTION
    let forms = [];
    try {
      forms = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('form')).map((form, index) => {
          const inputs = Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
            name: input.getAttribute('name') || input.getAttribute('id') || '',
            type: input.getAttribute('type') || input.tagName.toLowerCase(),
            value: input.value || ''
          }));
          return {
            index,
            action: form.getAttribute('action') || '',
            method: (form.getAttribute('method') || 'get').toLowerCase(),
            inputs
          };
        });
      });

      for (const form of forms) {
        if (form.method === 'post') {
          const hasCsrfToken = form.inputs.some(input => {
            const name = input.name.toLowerCase();
            return name.includes('csrf') || name.includes('xsrf') || name.includes('token');
          });

          if (!hasCsrfToken) {
            findings.push({
              type: "vulnerability",
              severity: "medium",
              description: "Form missing CSRF protection token",
              raw_output: \`Form index \${form.index} with action "\${form.action}" lacks any CSRF/anti-forgery parameters.\`,
              cve_ids: [],
              cvss_score: 4.3,
              epss_score: 0.01,
              remediation: "Implement state-changing CSRF verification tokens (e.g. anti-forgery tokens or SameSite cookie policies).",
              evidence: \`Form details: action="\${form.action}" inputs=\${JSON.stringify(form.inputs.map(i => i.name))}\`,
              endpoint: targetUrl,
              validated: true
            });
          }
        }
      }
    } catch (err) {
      // Form detection failed
    }

    // 3. FORM FUZZING (XSS & SQLi)
    const xssPayloads = customPayloads.xss || [
      "<script>alert(1)</script>",
      "<svg/onload=alert(1)>",
      "'\"><script>alert(1)</script>"
    ];

    const sqliPayloads = customPayloads.sqli || [
      "' OR '1'='1",
      "admin' --",
      "' UNION SELECT NULL--"
    ];

    const sqlErrors = [
      "SQL syntax", "mysql_fetch", "ORA-00933", "PostgreSQL query failed",
      "sqlite3.OperationalError", "Microsoft OLE DB Provider for SQL Server"
    ];

    // Fuzz each form input
    if (forms.length > 0) {
      for (const form of forms) {
        // Fuzz XSS
        for (const payload of xssPayloads) {
          let alertFired = false;
          let alertText = "";
          
          const fuzzPage = await context.newPage();
          fuzzPage.on('dialog', async dialog => {
            alertFired = true;
            alertText = dialog.message();
            await dialog.dismiss();
          });

          try {
            await fuzzPage.goto(targetUrl, { waitUntil: 'load', timeout: 10000 });
            
            // Fill form fields
            const inputCount = form.inputs.length;
            if (inputCount > 0) {
              // Fill all fields of this form
              for (let i = 0; i < inputCount; i++) {
                const inputMeta = form.inputs[i];
                if (inputMeta.type === 'submit' || inputMeta.type === 'button') continue;
                
                try {
                  const selector = \`form >> eq(\${form.index}) >> [name="\${inputMeta.name}"]\`;
                  await fuzzPage.fill(selector, payload, { timeout: 2000 }).catch(() => {
                    // Try by type/tag if name is missing or complex
                    return fuzzPage.fill(\`form >> eq(\${form.index}) >> input[type="\${inputMeta.type}"]\`, payload, { timeout: 2000 });
                  });
                } catch(e) {}
              }

              // Submit form
              await Promise.all([
                fuzzPage.keyboard.press('Enter'),
                fuzzPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => {})
              ]);

              if (alertFired) {
                findings.push({
                  type: "vulnerability",
                  severity: "high",
                  description: "Reflected Cross-Site Scripting (XSS) detected via form submission",
                  raw_output: \`XSS verified. Alert dialog triggered with message: "\${alertText}"\`,
                  cve_ids: [],
                  cvss_score: 7.2,
                  epss_score: 0.05,
                  remediation: "Sanitize and HTML-encode all user-supplied inputs before rendering them in the browser context.",
                  evidence: \`Injected payload "\${payload}" into form index \${form.index} at \${targetUrl}\`,
                  endpoint: targetUrl,
                  validated: true
                });
                break; // Found vulnerability, move to next check
              }
            }
          } catch (err) {
            // Ignore submission timeout
          } finally {
            await fuzzPage.close().catch(() => {});
          }
        }

        // Fuzz SQLi
        for (const payload of sqliPayloads) {
          const fuzzPage = await context.newPage();
          try {
            await fuzzPage.goto(targetUrl, { waitUntil: 'load', timeout: 10000 });
            const inputCount = form.inputs.length;
            if (inputCount > 0) {
              for (let i = 0; i < inputCount; i++) {
                const inputMeta = form.inputs[i];
                if (inputMeta.type === 'submit' || inputMeta.type === 'button') continue;
                try {
                  const selector = \`form >> eq(\${form.index}) >> [name="\${inputMeta.name}"]\`;
                  await fuzzPage.fill(selector, payload, { timeout: 2000 });
                } catch(e) {}
              }

              await Promise.all([
                fuzzPage.keyboard.press('Enter'),
                fuzzPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => {})
              ]);

              const bodyContent = await fuzzPage.textContent('body').catch(() => '');
              let foundError = false;
              let matchedError = "";
              for (const errorMarker of sqlErrors) {
                if (bodyContent && bodyContent.includes(errorMarker)) {
                  foundError = true;
                  matchedError = errorMarker;
                  break;
                }
              }

              if (foundError) {
                findings.push({
                  type: "vulnerability",
                  severity: "high",
                  description: "SQL Injection (SQLi) detected via form submission",
                  raw_output: \`SQL error detected in response: "\${matchedError}"\`,
                  cve_ids: [],
                  cvss_score: 8.8,
                  epss_score: 0.12,
                  remediation: "Use parameterized queries / prepared statements for all database queries. Avoid string concatenation of user inputs.",
                  evidence: \`Injected SQLi payload "\${payload}" into form index \${form.index} at \${targetUrl}\`,
                  endpoint: targetUrl,
                  validated: true
                });
                break;
              }
            }
          } catch(err) {
            // Ignore SQLi submission errors
          } finally {
            await fuzzPage.close().catch(() => {});
          }
        }
      }
    }

    // 4. WEAK AUTHENTICATION TEST
    let hasPasswordField = false;
    for (const form of forms) {
      if (form.inputs.some(input => input.type === 'password')) {
        hasPasswordField = true;
      }
    }
    if (hasPasswordField) {
      const defaultCreds = [
        { user: 'admin', pass: 'admin' },
        { user: 'admin', pass: 'password' },
        { user: 'guest', pass: 'guest' }
      ];

      for (const cred of defaultCreds) {
        const authPage = await context.newPage();
        try {
          await authPage.goto(targetUrl, { waitUntil: 'load', timeout: 10000 });
          
          // Fill username and password
          // Attempt to locate inputs
          const userSelector = 'input[type="text"], input[type="email"], input[name*="user"], input[name*="login"]';
          const passSelector = 'input[type="password"]';

          if (await authPage.$(userSelector) && await authPage.$(passSelector)) {
            await authPage.fill(userSelector, cred.user);
            await authPage.fill(passSelector, cred.pass);
            
            await Promise.all([
              authPage.keyboard.press('Enter'),
              authPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => {})
            ]);

            const bodyText = await authPage.textContent('body').catch(() => '');
            const hasErrorMessage = bodyText && (
              bodyText.toLowerCase().includes('incorrect') ||
              bodyText.toLowerCase().includes('invalid') ||
              bodyText.toLowerCase().includes('failed') ||
              bodyText.toLowerCase().includes('wrong')
            );

            // Simple heuristic: if we navigated or no error is shown, check if login succeeded
            // This is a basic scanner mock. In production, we'd check cookies or url change.
            if (!hasErrorMessage && (authPage.url() !== targetUrl || bodyText.toLowerCase().includes('dashboard') || bodyText.toLowerCase().includes('welcome'))) {
              findings.push({
                type: "credential",
                severity: "critical",
                description: "Weak default credentials accepted",
                raw_output: \`Successfully logged in using default credentials: username="\${cred.user}", password="\${cred.pass}"\`,
                cve_ids: [],
                cvss_score: 9.8,
                epss_score: 0.15,
                remediation: "Change all default credentials. Enforce strong password complexity rules and multi-factor authentication.",
                evidence: \`Login page: \${targetUrl} credentials: \${cred.user}/\${cred.pass}\`,
                endpoint: targetUrl,
                validated: true
              });
              break; // Found a weak credential, skip others
            }
          }
        } catch (err) {
          // Ignore
        } finally {
          await authPage.close().catch(() => {});
        }
      }
    }

    // 5. DOM XSS CHECK
    const domXssPayload = "#<script>alert(1)</script>";
    const domPage = await context.newPage();
    let domAlertFired = false;
    domPage.on('dialog', async dialog => {
      domAlertFired = true;
      await dialog.dismiss();
    });

    try {
      await domPage.goto(targetUrl + domXssPayload, { waitUntil: 'load', timeout: 10000 });
      await domPage.waitForTimeout(2000);
      if (domAlertFired) {
        findings.push({
          type: "vulnerability",
          severity: "high",
          description: "DOM-based Cross-Site Scripting (DOM XSS)",
          raw_output: "Alert dialog triggered via URL hash payload execution.",
          cve_ids: [],
          cvss_score: 7.2,
          epss_score: 0.04,
          remediation: "Ensure URL hash parameters or search parameters are safely processed and not directly written to document.write, innerHTML, or evaluated.",
          evidence: "Navigated to: " + targetUrl + domXssPayload,
          endpoint: targetUrl,
          validated: true
        });
      }
    } catch(err) {
      // Ignore
    } finally {
      await domPage.close().catch(() => {});
    }

    await context.close();

    console.log(JSON.stringify({
      success: true,
      findings
    }, null, 2));

  } catch (err) {
    console.log(JSON.stringify({
      success: false,
      error: err.message,
      findings: []
    }));
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

run();
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
      scannerPath: isWin ? "C:\\temp\\browser-scanner.js" : "/tmp/browser-scanner.js",
      tempDir: isWin ? "C:\\temp\\ultron-browser" : "/tmp/ultron-browser",
    };
  }

  async runScanner(options: BrowserAttackOptions): Promise<BrowserAttackResult> {
    const isWin = this.isWindows();
    const { scannerPath, tempDir } = this.getPaths();

    try {
      // 1. Write the scanner script to the sandbox
      if (isWin) {
        // Ensure C:\temp exists
        await this.sandbox.commands.run(`mkdir C:\\temp 2>nul || (exit 0)`);
      }
      await this.sandbox.files.write(scannerPath, BrowserAttackAgent.scannerScript);

      // 2. Ensure Playwright is installed inside the sandbox
      // (This will mirror BrowserManager's installation logic to guarantee package availability)
      const checkPlaywrightCmd = isWin
        ? `node -e "require('playwright')"`
        : `node -e "require('playwright')"`;

      const checkRes = await this.sandbox.commands.run(checkPlaywrightCmd).catch(() => ({ exitCode: 1 }));
      if (checkRes.exitCode !== 0) {
        // Playwright not in default node_modules, install it in the tempDir
        if (isWin) {
          await this.sandbox.commands.run(`mkdir "${tempDir}" 2>nul || (exit 0)`);
          await this.sandbox.commands.run(`cd "${tempDir}" && npm init -y`);
          await this.sandbox.commands.run(`cd "${tempDir}" && npm install playwright@1.60.0`);
          await this.sandbox.commands.run(`cd "${tempDir}" && npx playwright install chromium`);
        } else {
          await this.sandbox.commands.run(`mkdir -p "${tempDir}"`);
          await this.sandbox.commands.run(`cd "${tempDir}" && npm init -y`);
          await this.sandbox.commands.run(`cd "${tempDir}" && npm install playwright@1.60.0`);
          await this.sandbox.commands.run(`cd "${tempDir}" && sudo npx playwright install --with-deps chromium`);
        }
      }

      // 3. Run the scanner script
      const payloadsJson = JSON.stringify(options.payloads || {});
      const escapedPayloads = isWin
        ? payloadsJson.replace(/"/g, '""')
        : payloadsJson;

      const runCommand = isWin
        ? `node "${scannerPath}" "${options.targetUrl}" "${escapedPayloads}"`
        : `node "${scannerPath}" "${options.targetUrl}" '${payloadsJson}'`;

      const execRes = await this.sandbox.commands.run(runCommand, {
        timeoutMs: 90000 // 90 seconds timeout for full browser scans
      });

      if (execRes.exitCode !== 0) {
        return {
          success: false,
          findings: [],
          error: `Scanner script failed with exit code ${execRes.exitCode}. Stderr: ${execRes.stderr}`
        };
      }

      const output = JSON.parse(execRes.stdout.trim());
      return {
        success: output.success !== false,
        findings: output.findings || [],
        error: output.error
      };

    } catch (error) {
      return {
        success: false,
        findings: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
