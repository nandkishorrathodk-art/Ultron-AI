import { memo, useState } from "react";
import ToolBlock from "@/components/ui/tool-block";
import { Monitor, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { ChatStatus } from "@/types";

interface ComputerUseInput {
  action: string;
  brief?: string;
  x?: number;
  y?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  text?: string;
  key?: string;
  appName?: string;
}

interface ComputerUseOutput {
  success: boolean;
  screenshot: string | null; // base64
  error?: string;
}

interface ComputerUseToolHandlerProps {
  part: {
    toolCallId: string;
    state: string;
    input?: ComputerUseInput;
    output?: ComputerUseOutput;
    errorText?: string;
  };
  status: ChatStatus;
}

export const ComputerUseToolHandler = memo(function ComputerUseToolHandler({
  part,
  status,
}: ComputerUseToolHandlerProps) {
  const { toolCallId, state, input, output, errorText } = part;
  const [isOpen, setIsOpen] = useState(false);

  const getActionLabel = (isCompleted = false) => {
    if (input?.brief) return input.brief;
    const action = input?.action || "desktop action";
    const verb = isCompleted 
      ? action === "click" ? "Clicked" : action === "double_click" ? "Double-clicked" : action === "right_click" ? "Right-clicked" : action === "move" ? "Moved mouse" : action === "drag" ? "Dragged mouse" : action === "type" ? "Typed" : action === "press" ? "Pressed key" : action === "launch_app" ? "Launched app" : "Controlled desktop"
      : action === "click" ? "Clicking" : action === "double_click" ? "Double-clicking" : action === "right_click" ? "Right-clicking" : action === "move" ? "Moving mouse" : action === "drag" ? "Dragging mouse" : action === "type" ? "Typing" : action === "press" ? "Pressing key" : action === "launch_app" ? "Launching app" : "Controlling desktop";
    
    if (action === "click" || action === "double_click" || action === "right_click" || action === "move") {
      return `${verb} at (${input.x}, ${input.y})`;
    }
    if (action === "drag") {
      return `${verb} from (${input.fromX}, ${input.fromY}) to (${input.toX}, ${input.toY})`;
    }
    if (action === "type" && input.text) {
      return `${verb} "${input.text}"`;
    }
    if (action === "press" && input.key) {
      return `${verb} "${input.key}"`;
    }
    if (action === "launch_app" && input.appName) {
      return `${verb} "${input.appName}"`;
    }
    return `${verb}`;
  };

  const hasScreenshot = !!output?.screenshot;

  switch (state) {
    case "input-streaming":
      return status === "streaming" ? (
        <ToolBlock
          key={toolCallId}
          icon={<Monitor />}
          action={getActionLabel()}
          isShimmer={true}
        />
      ) : null;

    case "input-available":
      return status === "streaming" ? (
        <ToolBlock
          key={toolCallId}
          icon={<Monitor />}
          action={getActionLabel()}
          isShimmer={true}
        />
      ) : null;

    case "output-available":
      const success = output?.success ?? false;
      const errorMsg = output?.error || errorText;
      
      if (!success && errorMsg) {
        return (
          <div className="flex flex-col gap-2">
            <ToolBlock
              key={toolCallId}
              icon={<AlertCircle className="text-destructive" />}
              action={`Desktop control failed: ${errorMsg}`}
            />
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2">
            <ToolBlock
              key={toolCallId}
              icon={<Monitor className="text-primary" />}
              action={getActionLabel(true)}
              isClickable={hasScreenshot}
              onClick={() => setIsOpen(!isOpen)}
            />
            {hasScreenshot && (
              <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="p-1 hover:bg-muted/80 rounded transition-colors text-muted-foreground"
                aria-label={isOpen ? "Collapse desktop screenshot" : "Expand desktop screenshot"}
              >
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </div>

          {isOpen && hasScreenshot && (
            <div className="border border-border rounded-[15px] bg-muted/10 p-3 mt-1 flex flex-col gap-2 max-w-full overflow-hidden transition-all animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="text-[12px] text-muted-foreground mb-1 font-mono">
                <span className="font-bold text-foreground">Host Desktop Preview</span>
              </div>
              <div className="relative border border-border rounded-[10px] overflow-hidden bg-black/5 dark:bg-white/5">
                <img 
                  src={`data:image/png;base64,${output.screenshot}`} 
                  alt="Desktop screenshot" 
                  className="w-full h-auto object-contain max-h-[500px]"
                />
              </div>
            </div>
          )}
        </div>
      );

    case "output-error":
      return (
        <ToolBlock
          key={toolCallId}
          icon={<AlertCircle className="text-destructive" />}
          action={`Desktop control failed`}
        />
      );

    default:
      return null;
  }
});
