import { createBrowserTool } from "../browser-tool";
import { BrowserManager } from "../utils/browser-manager";

// Mock BrowserManager
jest.mock("../utils/browser-manager", () => {
  return {
    BrowserManager: jest.fn().mockImplementation(() => {
      return {
        executeAction: jest.fn().mockImplementation((action) => {
          if (action.url === "http://error-url.com") {
            return Promise.resolve({
              success: false,
              url: null,
              title: null,
              screenshot: null,
              error: "Failed to load page",
            });
          }
          return Promise.resolve({
            success: true,
            url: action.url || "https://google.com",
            title: "Mock Title",
            screenshot: "mock-base64-screenshot-data",
            result: null,
          });
        }),
      };
    }),
  };
});

describe("createBrowserTool", () => {
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

  it("should successfully execute a navigate action", async () => {
    const browserTool = createBrowserTool(mockContext);
    
    const result = await browserTool.execute(
      {
        action: "navigate",
        brief: "Navigate to google",
        url: "https://google.com",
      },
      { toolCallId: "call-123", abortSignal: new AbortController().signal }
    );

    expect(mockSandboxManager.getSandbox).toHaveBeenCalled();
    expect(BrowserManager).toHaveBeenCalledWith(mockSandbox);
    expect(result).toEqual({
      success: true,
      url: "https://google.com",
      title: "Mock Title",
      screenshot: "mock-base64-screenshot-data",
      result: null,
    });
  });

  it("should return failure details when action fails", async () => {
    const browserTool = createBrowserTool(mockContext);
    
    const result = await browserTool.execute(
      {
        action: "navigate",
        brief: "Navigate to bad url",
        url: "http://error-url.com",
      },
      { toolCallId: "call-123", abortSignal: new AbortController().signal }
    );

    expect(result).toEqual({
      success: false,
      url: null,
      title: null,
      screenshot: null,
      error: "Failed to load page",
    });
  });

  it("should catch errors thrown during execution and return them gracefully", async () => {
    // Force getSandbox to throw an error
    mockSandboxManager.getSandbox.mockRejectedValueOnce(new Error("Sandbox connection failed"));

    const browserTool = createBrowserTool(mockContext);
    
    const result = await browserTool.execute(
      {
        action: "navigate",
        brief: "Navigate to google",
        url: "https://google.com",
      },
      { toolCallId: "call-123", abortSignal: new AbortController().signal }
    );

    expect(result).toEqual({
      success: false,
      url: null,
      title: null,
      screenshot: null,
      error: "Sandbox connection failed",
    });
  });
});
