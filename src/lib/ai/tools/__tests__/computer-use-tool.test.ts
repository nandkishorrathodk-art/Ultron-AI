import { createComputerUseTool } from "../computer-use-tool";
import { DesktopController } from "../utils/desktop-controller";

// Mock DesktopController
jest.mock("../utils/desktop-controller", () => {
  return {
    DesktopController: jest.fn().mockImplementation(() => {
      return {
        executeAction: jest.fn().mockImplementation((action) => {
          return Promise.resolve({
            success: true,
            screenshot: "fake-base64-desktop-screenshot",
          });
        }),
      };
    }),
  };
});

describe("createComputerUseTool", () => {
  let mockSandbox: any;
  let mockSandboxManager: any;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSandbox = {
      sandboxKind: "centrifugo" as const,
      commands: { run: jest.fn() },
      files: { write: jest.fn() },
      isWindows: jest.fn().mockReturnValue(false),
    };

    mockSandboxManager = {
      getSandbox: jest.fn().mockResolvedValue({ sandbox: mockSandbox }),
      isSandboxUnavailable: jest.fn().mockReturnValue(false),
    };

    mockContext = {
      sandboxManager: mockSandboxManager,
      writer: { write: jest.fn() },
      userLocation: { country: "US" },
      userID: "user-123",
      chatId: "chat-456",
      mode: "agent",
    };
  });

  it("should successfully execute a click action on a local sandbox", async () => {
    const computerUseTool = createComputerUseTool(mockContext);
    
    const result = await computerUseTool.execute(
      {
        action: "click",
        brief: "Click at 100, 200",
        x: 100,
        y: 200,
      },
      { toolCallId: "call-1", abortSignal: new AbortController().signal }
    );

    expect(mockSandboxManager.getSandbox).toHaveBeenCalled();
    expect(DesktopController).toHaveBeenCalledWith(mockSandbox);
    expect(result).toEqual({
      success: true,
      screenshot: "fake-base64-desktop-screenshot",
    });
  });

  it("should block computer use and return failure on E2B cloud sandbox", async () => {
    // Modify sandbox mock to look like E2B (has jupyterUrl, no sandboxKind centrifugo)
    const e2bSandbox = {
      jupyterUrl: "http://localhost:8888",
      commands: { run: jest.fn() },
      files: { write: jest.fn() },
    };
    mockSandboxManager.getSandbox.mockResolvedValueOnce({ sandbox: e2bSandbox });

    const computerUseTool = createComputerUseTool(mockContext);
    
    const result = await computerUseTool.execute(
      {
        action: "screenshot",
        brief: "Take desktop screenshot",
      },
      { toolCallId: "call-2", abortSignal: new AbortController().signal }
    );

    expect(result).toEqual({
      success: false,
      screenshot: null,
      error: "Computer Use is only supported on a local desktop sandbox connection. It cannot run on E2B cloud.",
    });
  });

  it("should catch errors thrown during execution and return them gracefully", async () => {
    // Force getSandbox to throw an error
    mockSandboxManager.getSandbox.mockRejectedValueOnce(new Error("Local client disconnected"));

    const computerUseTool = createComputerUseTool(mockContext);
    
    const result = await computerUseTool.execute(
      {
        action: "click",
        brief: "Click",
        x: 0,
        y: 0,
      },
      { toolCallId: "call-3", abortSignal: new AbortController().signal }
    );

    expect(result).toEqual({
      success: false,
      screenshot: null,
      error: "Local client disconnected",
    });
  });
});
