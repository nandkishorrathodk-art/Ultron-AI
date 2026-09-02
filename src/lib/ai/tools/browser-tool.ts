import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "@/types";
import { BrowserManager } from "./utils/browser-manager";

export const createBrowserTool = (context: ToolContext) => {
  return tool({
    description: `Drive a browser in the sandbox to interact with websites.
Use this tool to navigate, click, type, and inspect web page content.
The browser runs persistently inside the sandbox, preserving session/login state across actions.
Each action returns the current URL, page title, a screenshot of the visible page area, and any action-specific result.

<supported_actions>
- \`navigate\`: Go to a specified URL.
- \`click\`: Click on a selector or at specific coordinates {x, y}.
- \`type\`: Type text into a selector.
- \`press\`: Press a keyboard key (e.g. Enter, Escape, Backspace).
- \`scroll\`: Scroll the page up or down.
- \`evaluate\`: Execute custom JavaScript inside the page.
- \`wait\`: Wait for a selector or for a specific time.
- \`screenshot\`: Capture a screenshot of the page.
- \`close\`: Close the current tab/page.
</supported_actions>`,
    inputSchema: z.object({
      action: z.enum([
        "navigate",
        "click",
        "type",
        "press",
        "scroll",
        "evaluate",
        "wait",
        "screenshot",
        "close",
      ]).describe("The browser action to perform"),
      brief: z
        .string()
        .describe("A brief description of what this action accomplishes"),
      url: z.string().optional().describe("URL to navigate to (required for navigate)"),
      selector: z
        .string()
        .optional()
        .describe("CSS selector for click/type/press/wait actions"),
      text: z.string().optional().describe("Text to type (required for type)"),
      key: z.string().optional().describe("Keyboard key to press (required for press)"),
      x: z.number().optional().describe("X coordinate for mouse click"),
      y: z.number().optional().describe("Y coordinate for mouse click"),
      direction: z.enum(["up", "down"]).optional().describe("Scroll direction"),
      script: z.string().optional().describe("JavaScript code to evaluate (required for evaluate)"),
      ms: z.number().optional().describe("Milliseconds to wait (for wait)"),
      timeout: z.number().optional().describe("Timeout in milliseconds (for wait)"),
    }),
    execute: async (input, { abortSignal }) => {
      try {
        const { sandbox } = await context.sandboxManager.getSandbox();
        const manager = new BrowserManager(sandbox);
        
        const result = await manager.executeAction({
          type: input.action,
          url: input.url,
          selector: input.selector,
          text: input.text,
          key: input.key,
          x: input.x,
          y: input.y,
          direction: input.direction,
          script: input.script,
          ms: input.ms,
          timeout: input.timeout,
        });

        return result;
      } catch (error) {
        return {
          success: false,
          url: null,
          title: null,
          screenshot: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
};
