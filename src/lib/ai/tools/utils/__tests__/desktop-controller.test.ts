import { DesktopController } from "../desktop-controller";

describe("DesktopController", () => {
  let mockSandbox: any;
  let controller: DesktopController;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSandbox = {
      sandboxKind: "centrifugo" as const,
      commands: {
        run: jest.fn().mockImplementation((command) => {
          return Promise.resolve({
            stdout: JSON.stringify({
              success: true,
              screenshot: "mock-base64-desktop-screenshot",
            }),
            stderr: "",
            exitCode: 0,
          });
        }),
      },
      files: {
        write: jest.fn().mockResolvedValue(undefined),
      },
      isWindows: jest.fn().mockReturnValue(false),
    };

    controller = new DesktopController(mockSandbox);
  });

  it("should write the desktop-agent.js script to the sandbox", async () => {
    await controller.ensureScriptWritten();
    
    expect(mockSandbox.files.write).toHaveBeenCalledWith(
      "/tmp/desktop-agent.js",
      expect.any(String)
    );
  });

  it("should successfully execute a click action and return output", async () => {
    const result = await controller.executeAction({
      type: "click",
      x: 100,
      y: 200,
    });

    expect(mockSandbox.files.write).toHaveBeenCalled();
    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      `node "/tmp/desktop-agent.js" '{"type":"click","x":100,"y":200}'`,
      expect.any(Object)
    );
    expect(result).toEqual({
      success: true,
      screenshot: "mock-base64-desktop-screenshot",
    });
  });

  it("should format commands correctly for Windows platform", async () => {
    mockSandbox.isWindows.mockReturnValue(true);
    const winController = new DesktopController(mockSandbox);

    const result = await winController.executeAction({
      type: "type",
      text: "hello",
    });

    expect(mockSandbox.commands.run).toHaveBeenCalledWith(
      `node "C:\\temp\\desktop-agent.js" "{""type"":""type"",""text"":""hello""}"`,
      expect.any(Object)
    );
    expect(result).toEqual({
      success: true,
      screenshot: "mock-base64-desktop-screenshot",
    });
  });

  it("should throw an error if instantiated with a non-Centrifugo sandbox", () => {
    const badSandbox = {
      jupyterUrl: "http://localhost",
      commands: { run: jest.fn() },
    };

    expect(() => new DesktopController(badSandbox as any)).toThrow(
      "Computer Use / Desktop Control is only available on a local sandbox connection."
    );
  });

  it("should return failure details when sandbox command execution fails", async () => {
    mockSandbox.commands.run.mockResolvedValueOnce({
      stdout: "internal error",
      stderr: "command execution timed out",
      exitCode: 1,
    });

    const result = await controller.executeAction({
      type: "screenshot",
    });

    expect(result.success).toBe(false);
    expect(result.screenshot).toBeNull();
    expect(result.error).toContain("Failed to parse desktop agent output");
  });
});
