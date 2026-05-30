import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "@/types";
import { DesktopController } from "./utils/desktop-controller";
import { isCentrifugoSandbox } from "./utils/sandbox-types";

export const createComputerUseTool = (context: ToolContext) => {
  return tool({
    description: `Control the host operating system's desktop keyboard, mouse, applications, and view screenshots.
This tool ONLY runs on local connections. The agent coordinates with the host windowing system.
Each mouse or keyboard action returns a base64 PNG screenshot of the primary screen immediately following the action.

<supported_actions>
- \`click\`: Left-click at a specified {x, y} position on the screen.
- \`double_click\`: Double left-click at {x, y}.
- \`right_click\`: Right-click at {x, y}.
- \`move\`: Move the mouse cursor to {x, y} without clicking.
- \`drag\`: Drag mouse from {fromX, fromY} to {toX, toY} holding left button.
- \`type\`: Type text strings.
- \`press\`: Press custom key combinations or control keys (e.g. enter, escape, backspace, pgup).
- \`launch_app\`: Launch specific applications by name or system command path.
- \`wait\`: Block execution for a few milliseconds (default: 2000).
- \`screenshot\`: Capture the current desktop screen.
</supported_actions>`,
    inputSchema: z.object({
      action: z.enum([
        "click",
        "double_click",
        "right_click",
        "move",
        "drag",
        "type",
        "press",
        "launch_app",
        "wait",
        "screenshot",
      ]).describe("The desktop action to perform"),
      brief: z
        .string()
        .describe("A brief description of what this desktop action accomplishes"),
      x: z.number().optional().describe("X coordinate for mouse actions"),
      y: z.number().optional().describe("Y coordinate for mouse actions"),
      fromX: z.number().optional().describe("Starting X coordinate for drag"),
      fromY: z.number().optional().describe("Starting Y coordinate for drag"),
      toX: z.number().optional().describe("Ending X coordinate for drag"),
      toY: z.number().optional().describe("Ending Y coordinate for drag"),
      text: z.string().optional().describe("Text to type"),
      key: z.string().optional().describe("Keyboard key to press"),
      appName: z.string().optional().describe("Name/path of app to launch"),
      ms: z.number().optional().describe("Wait duration in milliseconds"),
    }),
    execute: async (input, { abortSignal }) => {
      try {
        const { sandbox } = await context.sandboxManager.getSandbox();
        
        if (!isCentrifugoSandbox(sandbox)) {
          return {
            success: false,
            screenshot: null,
            error: "Computer Use is only supported on a local desktop sandbox connection. It cannot run on E2B cloud.",
          };
        }

        const controller = new DesktopController(sandbox);
        
        const result = await controller.executeAction({
          type: input.action,
          x: input.x,
          y: input.y,
          fromX: input.fromX,
          fromY: input.fromY,
          toX: input.toX,
          toY: input.toY,
          text: input.text,
          key: input.key,
          appName: input.appName,
          ms: input.ms,
        });

        return result;
      } catch (error) {
        return {
          success: false,
          screenshot: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
};
