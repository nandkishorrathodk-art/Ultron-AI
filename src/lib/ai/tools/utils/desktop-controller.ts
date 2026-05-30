import type { AnySandbox } from "@/types";
import { isCentrifugoSandbox } from "./sandbox-types";

export interface ComputerUseActionInput {
  type: "click" | "double_click" | "right_click" | "move" | "drag" | "type" | "press" | "launch_app" | "wait" | "screenshot";
  x?: number;
  y?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  text?: string;
  key?: string;
  appName?: string;
  ms?: number;
}

export interface ComputerUseActionResult {
  success: boolean;
  screenshot: string | null; // base64
  error?: string;
}

export class DesktopController {
  private static agentScript = `
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

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

  const platform = os.platform();
  const tempDir = platform === 'win32' ? 'C:\\\\temp' : '/tmp';
  const screenshotPath = path.join(tempDir, \`screenshot_\${Date.now()}.png\`);

  // Ensure tempDir exists
  if (!fs.existsSync(tempDir)) {
    try { fs.mkdirSync(tempDir, { recursive: true }); } catch (e) {}
  }

  try {
    switch (action.type) {
      case 'click':
      case 'double_click':
      case 'right_click':
      case 'move':
      case 'drag':
        if (platform === 'win32') {
          const psScriptPath = path.join(tempDir, \`mouse_\${Date.now()}.ps1\`);
          let psContent = \`Add-Type -AssemblyName System.Windows.Forms\\n\`;
          psContent += \`$signature = '[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);'\\n\`;
          psContent += \`$type = Add-Type -MemberDefinition $signature -Name "Win32Mouse" -Namespace Win32Functions -PassThru\\n\`;

          if (action.type === 'drag') {
            psContent += \`[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(\${action.fromX}, \${action.fromY})\\n\`;
            psContent += \`$type::mouse_event(0x0002, 0, 0, 0, 0)\\n\`;
            psContent += \`Start-Sleep -Milliseconds 200\\n\`;
            psContent += \`[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(\${action.toX}, \${action.toY})\\n\`;
            psContent += \`$type::mouse_event(0x0004, 0, 0, 0, 0)\\n\`;
          } else {
            psContent += \`[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(\${action.x}, \${action.y})\\n\`;
            if (action.type === 'click') {
              psContent += \`$type::mouse_event(0x0002, 0, 0, 0, 0)\\n\`;
              psContent += \`$type::mouse_event(0x0004, 0, 0, 0, 0)\\n\`;
            } else if (action.type === 'right_click') {
              psContent += \`$type::mouse_event(0x0008, 0, 0, 0, 0)\\n\`;
              psContent += \`$type::mouse_event(0x0010, 0, 0, 0, 0)\\n\`;
            } else if (action.type === 'double_click') {
              psContent += \`$type::mouse_event(0x0002, 0, 0, 0, 0)\\n\`;
              psContent += \`$type::mouse_event(0x0004, 0, 0, 0, 0)\\n\`;
              psContent += \`Start-Sleep -Milliseconds 100\\n\`;
              psContent += \`$type::mouse_event(0x0002, 0, 0, 0, 0)\\n\`;
              psContent += \`$type::mouse_event(0x0004, 0, 0, 0, 0)\\n\`;
            }
          }
          fs.writeFileSync(psScriptPath, psContent);
          execSync(\`powershell -ExecutionPolicy Bypass -File "\${psScriptPath}"\`);
          try { fs.unlinkSync(psScriptPath); } catch (e) {}
        } else if (platform === 'darwin') {
          if (action.type === 'drag') {
            execSync(\`osascript -e 'tell application "System Events" to drag from {\${action.fromX}, \${action.fromY}} to {\${action.toX}, \${action.toY}}'\`);
          } else {
            const clickCmd = action.type === 'right_click' ? 'right click' : 'click';
            execSync(\`osascript -e 'tell application "System Events" to \${clickCmd} at {\${action.x}, \${action.y}}'\`);
          }
        } else {
          if (action.type === 'drag') {
            execSync(\`xdotool mousemove \${action.fromX} \${action.fromY} mousedown 1 mousemove \${action.toX} \${action.toY} mouseup 1\`);
          } else {
            const button = action.type === 'right_click' ? '3' : '1';
            const clickOpt = action.type === 'double_click' ? '--repeat 2 --delay 100' : '';
            execSync(\`xdotool mousemove \${action.x} \${action.y} click \${clickOpt} \${button}\`);
          }
        }
        break;

      case 'type':
        if (platform === 'win32') {
          const escapedText = action.text.replace(/[+^%~(){}[\\]]/g, '{$&}');
          const psScriptPath = path.join(tempDir, \`type_\${Date.now()}.ps1\`);
          fs.writeFileSync(psScriptPath, \`Add-Type -AssemblyName System.Windows.Forms\\n[System.Windows.Forms.SendKeys]::SendWait("\${escapedText}")\`);
          execSync(\`powershell -ExecutionPolicy Bypass -File "\${psScriptPath}"\`);
          try { fs.unlinkSync(psScriptPath); } catch (e) {}
        } else if (platform === 'darwin') {
          execSync(\`osascript -e 'tell application "System Events" to keystroke "\${action.text.replace(/"/g, '\\\\"')}"'\`);
        } else {
          execSync(\`xdotool type "\${action.text.replace(/"/g, '\\\\"')}"\`);
        }
        break;

      case 'press':
        if (platform === 'win32') {
          const keyMap = {
            enter: "{ENTER}", escape: "{ESC}", backspace: "{BACKSPACE}", tab: "{TAB}",
            up: "{UP}", down: "{DOWN}", left: "{LEFT}", right: "{RIGHT}",
            pgup: "{PGUP}", pgdn: "{PGDN}", end: "{END}", home: "{HOME}", delete: "{DEL}"
          };
          const keyStroke = keyMap[action.key.toLowerCase()] || action.key;
          const psScriptPath = path.join(tempDir, \`key_\${Date.now()}.ps1\`);
          fs.writeFileSync(psScriptPath, \`Add-Type -AssemblyName System.Windows.Forms\\n[System.Windows.Forms.SendKeys]::SendWait("\${keyStroke}")\`);
          execSync(\`powershell -ExecutionPolicy Bypass -File "\${psScriptPath}"\`);
          try { fs.unlinkSync(psScriptPath); } catch (e) {}
        } else if (platform === 'darwin') {
          execSync(\`osascript -e 'tell application "System Events" to key code \${action.key}'\`);
        } else {
          execSync(\`xdotool key "\${action.key}"\`);
        }
        break;

      case 'launch_app':
        if (platform === 'win32') {
          execSync(\`powershell -Command "Start-Process '\${action.appName}'"\`);
        } else if (platform === 'darwin') {
          execSync(\`open -a "\${action.appName}"\`);
        } else {
          execSync(\`xdg-open "\${action.appName}" &\`);
        }
        break;

      case 'wait':
        const waitMs = action.ms || 2000;
        execSync(platform === 'win32' ? \`powershell -Command "Start-Sleep -Milliseconds \${waitMs}"\` : \`sleep \${waitMs / 1000}\`);
        break;

      case 'screenshot':
        break;

      default:
        throw new Error("Unknown action: " + action.type);
    }

    if (platform === 'win32') {
      const psScriptPath = path.join(tempDir, \`snap_\${Date.now()}.ps1\`);
      let psContent = \`Add-Type -AssemblyName System.Windows.Forms\\n\`;
      psContent += \`Add-Type -AssemblyName System.Drawing\\n\`;
      psContent += \`$screen = [System.Windows.Forms.Screen]::PrimaryScreen\\n\`;
      psContent += \`$bounds = $screen.Bounds\\n\`;
      psContent += \`$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height\\n\`;
      psContent += \`$graphics = [System.Drawing.Graphics]::FromImage($bitmap)\\n\`;
      psContent += \`$graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)\\n\`;
      psContent += \`$bitmap.Save("\${screenshotPath.replace(/\\\\/g, '\\\\\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)\\n\`;
      psContent += \`$graphics.Dispose()\\n\`;
      psContent += \`$bitmap.Dispose()\\n\`;
      fs.writeFileSync(psScriptPath, psContent);
      execSync(\`powershell -ExecutionPolicy Bypass -File "\${psScriptPath}"\`);
      try { fs.unlinkSync(psScriptPath); } catch (e) {}
    } else if (platform === 'darwin') {
      execSync(\`screencapture -x "\${screenshotPath}"\`);
    } else {
      execSync(\`scrot "\${screenshotPath}" || import -window root "\${screenshotPath}"\`);
    }

    let screenshotBase64 = null;
    if (fs.existsSync(screenshotPath)) {
      screenshotBase64 = fs.readFileSync(screenshotPath).toString('base64');
      try { fs.unlinkSync(screenshotPath); } catch (e) {}
    }

    console.log(JSON.stringify({
      success: true,
      screenshot: screenshotBase64
    }));

  } catch (err) {
    if (fs.existsSync(screenshotPath)) {
      try { fs.unlinkSync(screenshotPath); } catch (e) {}
    }
    console.log(JSON.stringify({
      success: false,
      error: err.message,
      stack: err.stack
    }));
  }
}

run();
  `;

  constructor(private sandbox: AnySandbox) {
    if (!isCentrifugoSandbox(sandbox)) {
      throw new Error("Computer Use / Desktop Control is only available on a local sandbox connection.");
    }
  }

  private isWindows(): boolean {
    return (this.sandbox as any).isWindows?.() || false;
  }

  private getPaths() {
    const isWin = this.isWindows();
    return {
      agentPath: isWin ? "C:\\temp\\desktop-agent.js" : "/tmp/desktop-agent.js",
    };
  }

  async ensureScriptWritten(): Promise<void> {
    await this.sandbox.files.write("/tmp/desktop-agent.js", DesktopController.agentScript);
  }

  async executeAction(action: ComputerUseActionInput): Promise<ComputerUseActionResult> {
    const { agentPath } = this.getPaths();
    
    // Always write script fresh to ensure latest version runs
    await this.ensureScriptWritten();

    const actionJsonString = JSON.stringify(action);
    const isWin = this.isWindows();
    
    // Windows double escape quotes for cmd.exe
    const escapedJson = isWin 
      ? actionJsonString.replace(/"/g, '""')
      : actionJsonString;

    const command = isWin
      ? `node "${agentPath}" "${escapedJson}"`
      : `node "${agentPath}" '${actionJsonString}'`;

    const res = await this.sandbox.commands.run(command, {
      displayName: `Executing desktop action: ${action.type}`,
    });

    try {
      const output = JSON.parse(res.stdout.trim());
      return output as ComputerUseActionResult;
    } catch (e) {
      return {
        success: false,
        screenshot: null,
        error: `Failed to parse desktop agent output: ${res.stdout}\nStderr: ${res.stderr}\nError: ${(e as Error).message}`,
      };
    }
  }
}
