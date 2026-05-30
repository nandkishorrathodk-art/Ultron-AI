import { BrowserAttackAgent } from "../browser-attack";

describe("BrowserAttackAgent", () => {
  let mockSandbox: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSandbox = {
      sandboxKind: "centrifugo" as const,
      commands: {
        run: jest.fn().mockResolvedValue({
          exitCode: 0,
          stdout: JSON.stringify({
            success: true,
            findings: [
              {
                type: "vulnerability",
                severity: "high",
                description: "Reflected Cross-Site Scripting (XSS) detected via form submission",
                raw_output: 'XSS verified. Alert dialog triggered with message: "1"',
                cve_ids: [],
                cvss_score: 7.2,
                epss_score: 0.05,
                remediation: "Sanitize inputs.",
                evidence: 'Injected payload into form index 0',
                endpoint: "http://target-website.local",
                validated: true
              }
            ]
          }),
          stderr: ""
        })
      },
      files: {
        write: jest.fn().mockResolvedValue(undefined)
      },
      isWindows: jest.fn().mockReturnValue(false)
    };
  });

  it("should successfully write scanner script and execute it on E2B sandbox", async () => {
    // E2B sandbox type (no centrifugo kind)
    const e2bSandbox: any = {
      commands: {
        run: jest.fn().mockImplementation((cmd) => {
          if (cmd.includes("node -e")) {
            return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }); // Playwright is installed
          }
          return Promise.resolve({
            exitCode: 0,
            stdout: JSON.stringify({
              success: true,
              findings: [
                {
                  type: "vulnerability",
                  severity: "medium",
                  description: "Missing Clickjacking protection headers",
                  raw_output: "Headers check",
                  cve_ids: [],
                  cvss_score: 5.0,
                  epss_score: 0.01,
                  remediation: "Configure headers",
                  evidence: "Headers missing",
                  endpoint: "http://target-website.local",
                  validated: true
                }
              ]
            }),
            stderr: ""
          });
        })
      },
      files: {
        write: jest.fn().mockResolvedValue(undefined)
      }
    };

    const agent = new BrowserAttackAgent(e2bSandbox);
    const result = await agent.runScanner({ targetUrl: "http://target-website.local" });

    expect(e2bSandbox.files.write).toHaveBeenCalledWith("/tmp/browser-scanner.js", expect.any(String));
    expect(result.success).toBe(true);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].description).toBe("Missing Clickjacking protection headers");
  });

  it("should run scanner on Windows centrifugo sandbox and double escape quotes", async () => {
    mockSandbox.isWindows.mockReturnValue(true);
    mockSandbox.commands.run.mockImplementation((cmd) => {
      if (cmd.includes("node -e")) {
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      }
      return Promise.resolve({
        exitCode: 0,
        stdout: JSON.stringify({
          success: true,
          findings: []
        }),
        stderr: ""
      });
    });

    const agent = new BrowserAttackAgent(mockSandbox);
    const result = await agent.runScanner({
      targetUrl: "http://target-website.local",
      payloads: {
        xss: ["<script>alert(1)</script>"]
      }
    });

    expect(mockSandbox.files.write).toHaveBeenCalledWith("C:\\temp\\browser-scanner.js", expect.any(String));
    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      expect.stringContaining("C:\\temp\\browser-scanner.js"),
      expect.any(Object)
    );
    expect(result.success).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("should install Playwright if not already installed", async () => {
    let installCalled = false;
    mockSandbox.commands.run.mockImplementation((cmd) => {
      if (cmd.includes("node -e")) {
        return Promise.resolve({ exitCode: 1, stdout: "", stderr: "Playwright not found" }); // Force failure for install check
      }
      if (cmd.includes("npm install playwright")) {
        installCalled = true;
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      }
      if (cmd.includes("npx playwright install")) {
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      }
      return Promise.resolve({
        exitCode: 0,
        stdout: JSON.stringify({
          success: true,
          findings: []
        }),
        stderr: ""
      });
    });

    const agent = new BrowserAttackAgent(mockSandbox);
    const result = await agent.runScanner({ targetUrl: "http://target-website.local" });

    expect(installCalled).toBe(true);
    expect(result.success).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("should handle error exit code from scanner script", async () => {
    mockSandbox.commands.run.mockImplementation((cmd) => {
      if (cmd.includes("node -e")) {
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      }
      return Promise.resolve({
        exitCode: 1,
        stdout: "",
        stderr: "Internal server error inside browser connection"
      });
    });

    const agent = new BrowserAttackAgent(mockSandbox);
    const result = await agent.runScanner({ targetUrl: "http://target-website.local" });

    expect(result.success).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.error).toContain("Scanner script failed with exit code 1");
  });
});
