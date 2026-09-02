import { BrowserManager } from "../browser-manager";

describe("BrowserManager", () => {
  let mockSandbox: any;
  let manager: BrowserManager;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSandbox = {
      sandboxKind: "centrifugo" as const,
      commands: {
        run: jest.fn().mockImplementation((command) => {
          if (command.includes("type") || command.includes("cat")) {
            return Promise.resolve({ stdout: "ws://127.0.0.1:4444", stderr: "", exitCode: 0 });
          }
          if (command.includes("ws.txt")) {
            return Promise.resolve({ stdout: "YES", stderr: "", exitCode: 0 });
          }
          return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
        }),
      },
      files: {
        write: jest.fn().mockResolvedValue(undefined),
      },
      isWindows: jest.fn().mockReturnValue(false),
    };

    manager = new BrowserManager(mockSandbox);
  });

  it("should write scripts to the sandbox", async () => {
    await manager.ensureScriptsWritten();
    expect(mockSandbox.files.write).toHaveBeenCalledWith(
      "/tmp/browser-controller.js",
      expect.any(String)
    );
    expect(mockSandbox.files.write).toHaveBeenCalledWith(
      "/tmp/browser-server.js",
      expect.any(String)
    );
  });

  it("should write scripts to Windows paths if sandbox is Windows", async () => {
    mockSandbox.isWindows.mockReturnValue(true);
    const winManager = new BrowserManager(mockSandbox);
    await winManager.ensureScriptsWritten();

    // getPaths() returns C:\temp paths on Windows, so ensureScriptsWritten should use those
    expect(mockSandbox.files.write).toHaveBeenCalledWith(
      "C:\\temp\\browser-controller.js",
      expect.any(String)
    );
    expect(mockSandbox.files.write).toHaveBeenCalledWith(
      "C:\\temp\\browser-server.js",
      expect.any(String)
    );
  });

  it("should install Playwright on Linux sandbox", async () => {
    await manager.installPlaywright();

    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      'mkdir -p "/tmp/ultron-browser"',
      expect.any(Object)
    );
    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      'cd "/tmp/ultron-browser" && npm init -y',
      expect.any(Object)
    );
    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      'cd "/tmp/ultron-browser" && npm install playwright@1.60.0',
      expect.any(Object)
    );
    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      'cd "/tmp/ultron-browser" && sudo npx playwright install --with-deps chromium',
      expect.any(Object)
    );
  });

  it("should install Playwright on Windows sandbox", async () => {
    mockSandbox.isWindows.mockReturnValue(true);
    const winManager = new BrowserManager(mockSandbox);
    await winManager.installPlaywright();

    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      'mkdir "C:\\temp\\ultron-browser" 2>nul || (exit 0)',
      expect.any(Object)
    );
    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      'cd "C:\\temp\\ultron-browser" && npx playwright install chromium',
      expect.any(Object)
    );
  });

  it("should start the background browser server", async () => {
    await manager.startBrowserServer();

    // Verify background run command was triggered
    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      'node "/tmp/browser-server.js"',
      expect.objectContaining({ background: true })
    );

    // Verify it checked if the WS file was written
    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      '[ -f "/tmp/browser-ws.txt" ] && echo YES || echo NO',
      expect.any(Object)
    );
    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      'cat "/tmp/browser-ws.txt"',
      expect.any(Object)
    );
  });

  it("should successfully execute a browser action", async () => {
    mockSandbox.commands.run.mockResolvedValueOnce({
      stdout: JSON.stringify({
        success: true,
        url: "https://example.com",
        title: "Example Domain",
        screenshot: "dummy-screenshot",
      }),
      stderr: "",
      exitCode: 0,
    });

    const result = await manager.executeAction({
      type: "navigate",
      url: "https://example.com",
    });

    expect(mockSandbox.files.write).toHaveBeenCalled();
    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      `node "/tmp/browser-controller.js" '{"type":"navigate","url":"https://example.com"}'`,
      expect.any(Object)
    );
    expect(result).toEqual({
      success: true,
      url: "https://example.com",
      title: "Example Domain",
      screenshot: "dummy-screenshot",
    });
  });

  it("should perform self-healing and install if controller returns needsInstall", async () => {
    // 1st call returns needsInstall
    mockSandbox.commands.run.mockResolvedValueOnce({
      stdout: JSON.stringify({ needsInstall: true }),
      stderr: "",
      exitCode: 0,
    });

    // 2nd call (retry) returns success
    mockSandbox.commands.run.mockResolvedValueOnce({
      stdout: JSON.stringify({
        success: true,
        url: "https://example.com",
        title: "Example Domain",
        screenshot: "dummy-screenshot",
      }),
      stderr: "",
      exitCode: 0,
    });

    const installSpy = jest.spyOn(manager, "installPlaywright").mockResolvedValue(undefined);

    const result = await manager.executeAction({
      type: "navigate",
      url: "https://example.com",
    });

    expect(installSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("should perform self-healing and start server if controller returns needsStartServer", async () => {
    // 1st call returns needsStartServer
    mockSandbox.commands.run.mockResolvedValueOnce({
      stdout: JSON.stringify({ needsStartServer: true }),
      stderr: "",
      exitCode: 0,
    });

    // 2nd call (retry) returns success
    mockSandbox.commands.run.mockResolvedValueOnce({
      stdout: JSON.stringify({
        success: true,
        url: "https://example.com",
        title: "Example Domain",
        screenshot: "dummy-screenshot",
      }),
      stderr: "",
      exitCode: 0,
    });

    const startSpy = jest.spyOn(manager, "startBrowserServer").mockResolvedValue(undefined);

    const result = await manager.executeAction({
      type: "navigate",
      url: "https://example.com",
    });

    expect(startSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
