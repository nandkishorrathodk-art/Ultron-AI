import { memo, useState } from "react";
import ToolBlock from "@/components/ui/tool-block";
import { Globe, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { ChatStatus } from "@/types";

interface BrowserToolInput {
  action: string;
  brief?: string;
  url?: string;
  selector?: string;
  text?: string;
  key?: string;
  x?: number;
  y?: number;
  direction?: string;
  script?: string;
}

interface BrowserToolOutput {
  success: boolean;
  url: string | null;
  title: string | null;
  screenshot: string | null; // base64
  result?: any;
  error?: string;
}

interface BrowserToolHandlerProps {
  part: {
    toolCallId: string;
    state: string;
    input?: BrowserToolInput;
    output?: BrowserToolOutput;
    errorText?: string;
  };
  status: ChatStatus;
}

export const BrowserToolHandler = memo(function BrowserToolHandler({
  part,
  status,
}: BrowserToolHandlerProps) {
  const { toolCallId, state, input, output, errorText } = part;
  const [isOpen, setIsOpen] = useState(false);

  const getActionLabel = (isCompleted = false) => {
    if (input?.brief) return input.brief;
    const action = input?.action || "browse";
    const verb = isCompleted 
      ? action === "navigate" ? "Navigated" : action === "click" ? "Clicked" : action === "type" ? "Typed in" : action === "scroll" ? "Scrolled" : "Browsed"
      : action === "navigate" ? "Navigating" : action === "click" ? "Clicking" : action === "type" ? "Typing in" : action === "scroll" ? "Scrolling" : "Browsing";
    
    if (input?.url) return `${verb} to ${input.url}`;
    if (input?.selector) return `${verb} "${input.selector}"`;
    return `${verb}`;
  };

  const hasScreenshot = !!output?.screenshot;

  switch (state) {
    case "input-streaming":
      return status === "streaming" ? (
        <ToolBlock
          key={toolCallId}
          icon={<Globe />}
          action={getActionLabel()}
          isShimmer={true}
        />
      ) : null;

    case "input-available":
      return status === "streaming" ? (
        <ToolBlock
          key={toolCallId}
          icon={<Globe />}
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
              action={`Browsing failed: ${errorMsg}`}
            />
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2">
            <ToolBlock
              key={toolCallId}
              icon={<Globe className="text-primary" />}
              action={getActionLabel(true)}
              target={output?.url || undefined}
              isClickable={hasScreenshot}
              onClick={() => setIsOpen(!isOpen)}
            />
            {hasScreenshot && (
              <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="p-1 hover:bg-muted/80 rounded transition-colors text-muted-foreground"
                aria-label={isOpen ? "Collapse screenshot" : "Expand screenshot"}
              >
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </div>

          {isOpen && hasScreenshot && (
            <div className="border border-border rounded-[15px] bg-muted/10 p-3 mt-1 flex flex-col gap-2 max-w-full overflow-hidden transition-all animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex flex-col gap-1 text-[12px] text-muted-foreground mb-1 font-mono">
                {output?.title && (
                  <div className="truncate">
                    <span className="font-bold text-foreground">Title:</span> {output.title}
                  </div>
                )}
                {output?.url && (
                  <div className="truncate">
                    <span className="font-bold text-foreground">URL:</span> {output.url}
                  </div>
                )}
                {output?.result !== undefined && output?.result !== null && (
                  <div className="bg-muted/30 p-2 rounded border border-border/50 max-h-[150px] overflow-y-auto mt-1">
                    <span className="font-bold text-foreground block mb-0.5">Evaluation Result:</span>
                    <pre className="text-[11px] whitespace-pre-wrap">{JSON.stringify(output.result, null, 2)}</pre>
                  </div>
                )}
              </div>
              <div className="relative border border-border rounded-[10px] overflow-hidden bg-black/5 dark:bg-white/5">
                <img 
                  src={`data:image/png;base64,${output.screenshot}`} 
                  alt="Page screenshot" 
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
          action={`Browsing failed`}
        />
      );

    default:
      return null;
  }
});
