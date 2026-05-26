"use client";

import { useChat } from "@ai-sdk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Send, TerminalSquare, User, Globe, FileText, FileEdit, Package } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AgentApprovalGate } from "@/components/AgentApprovalGate";
import { useState, useCallback } from "react";
import { DefaultChatTransport } from "ai";
import type { FlowMode } from "@/lib/agent/flow";

// Module-level session ID — persists across re-renders without triggering ref-in-render lint
let currentSessionId: string | null = null;

// ─── Auto Flow Mode Detection ─────────────────────────────────────────────────
const FLOW_MODE_PATTERNS: { mode: FlowMode; patterns: RegExp[] }[] = [
  { mode: "ctf", patterns: [/\bctf\b/i, /\bcapture.the.flag\b/i, /\bchallenge\b/i, /\bflag\b/i] },
  { mode: "bug_bounty", patterns: [/\bbug.?bounty\b/i, /\bhackerone\b/i, /\bbugcrowd\b/i, /\bbounty\b/i] },
  { mode: "ai_redteam", patterns: [/\bai.?red.?team/i, /\bllm.?(attack|inject|jailbreak)/i, /\bprompt.?inject/i] },
  { mode: "cicd", patterns: [/\bci\/?cd\b/i, /\bpipeline\b/i, /\bgithub.?action/i, /\bjenkins\b/i, /\bdevops\b/i] },
  { mode: "continuous", patterns: [/\bcontinuous\b/i, /\bmonitor/i, /\b24\/7\b/i, /\bscheduled?\b/i] },
];

function detectFlowMode(message: string): FlowMode {
  for (const { mode, patterns } of FLOW_MODE_PATTERNS) {
    if (patterns.some((p) => p.test(message))) return mode;
  }
  return "standard";
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ToolArgs {
  command?: string;
  query?: string;
  path?: string;
  tool_name?: string;
  method?: string;
}

interface ToolResult {
  status?: string;
  stdout?: string;
  stderr?: string;
  result?: string;
  content?: string;
  bytes?: number;
  output?: string;
  error?: string;
  risk_level?: string;
  command?: string;
  justification?: string;
}

interface ToolInvocationData {
  toolName: string;
  toolCallId: string;
  args: ToolArgs;
  result?: ToolResult;
  state: string;
}

interface MessagePart {
  type: string;
  text?: string;
  toolInvocation?: ToolInvocationData;
  toolCallId?: string;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  parts?: MessagePart[];
  toolInvocations?: ToolInvocationData[];
}

// ─── Tool Result Renderer ─────────────────────────────────────────────────────
function ToolResultDisplay({ toolInvocation }: { toolInvocation: ToolInvocationData }) {
  const toolName = toolInvocation.toolName;
  const args = toolInvocation.args ?? {};
  const result = toolInvocation.result ?? {};

  let label = "";
  let content = "";
  let errorContent = "";

  switch (toolName) {
    case "execute_bash":
      label = `$ ${args.command ?? "unknown command"}`;
      content = result.stdout ?? "(no output)";
      errorContent = result.stderr ?? "";
      break;
    case "web_search":
      label = `Search: ${args.query ?? ""}`;
      content = result.result ?? "(no results)";
      break;
    case "read_file":
      label = `Read: ${args.path ?? ""}`;
      content = result.content ?? "(empty file)";
      break;
    case "write_file":
      label = `Write: ${args.path ?? ""}`;
      content = result.bytes ? `Written ${result.bytes} bytes` : "File written";
      break;
    case "install_tool":
      label = `Install: ${args.tool_name ?? ""} (${args.method ?? ""})`;
      content = result.output ?? "Installed";
      break;
    default:
      label = `Tool: ${toolName}`;
      content = JSON.stringify(result, null, 2);
  }

  const iconMap: Record<string, typeof TerminalSquare> = {
    execute_bash: TerminalSquare,
    web_search: Globe,
    read_file: FileText,
    write_file: FileEdit,
    install_tool: Package,
  };
  const IconComponent = iconMap[toolName] ?? TerminalSquare;

  return (
    <div className="p-3 bg-black/50 rounded border border-primary/30 font-mono text-xs text-green-400">
      <div className="flex items-center gap-2 mb-2">
        <IconComponent className="w-4 h-4" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-muted-foreground whitespace-pre-wrap break-all">
        {content}
        {errorContent && (
          <span className="text-red-400">{errorContent}</span>
        )}
      </div>
    </div>
  );
}

// ─── Tool Invocation Component ────────────────────────────────────────────────
function ToolInvocationDisplay({
  toolInvocation,
  onApprove,
  onDeny,
}: {
  toolInvocation: ToolInvocationData;
  onApprove: (taskId: string) => void;
  onDeny: (taskId: string) => void;
}) {
  const toolName = toolInvocation.toolName;
  const args = toolInvocation.args ?? {};

  if (toolInvocation.state === "result") {
    if (toolInvocation.result?.status === "hitl_required") {
      return (
        <AgentApprovalGate
          action={{
            taskId: toolInvocation.toolCallId,
            riskLevel: (toolInvocation.result.risk_level as "yellow" | "red") ?? "red",
            command: toolInvocation.result.command ?? "",
            justification: toolInvocation.result.justification ?? "",
          }}
          onApprove={onApprove}
          onDeny={onDeny}
        />
      );
    }

    return <ToolResultDisplay toolInvocation={toolInvocation} />;
  }

  const runningLabel = toolName === "execute_bash"
    ? args.command
    : toolName === "web_search"
      ? `Searching: ${args.query}`
      : toolName === "read_file"
        ? `Reading: ${args.path}`
        : toolName === "write_file"
          ? `Writing: ${args.path}`
          : toolName === "install_tool"
            ? `Installing: ${args.tool_name}`
            : toolName;

  return (
    <div className="p-3 bg-black/50 rounded border border-primary/30 font-mono text-xs text-green-400">
      <div className="flex items-center gap-2 mb-2">
        <TerminalSquare className="w-4 h-4" />
        <span>Executing: {runningLabel}</span>
      </div>
      <div className="mt-2 text-muted-foreground animate-pulse">Running in sandbox...</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [input, setInput] = useState("");
  const [detectedMode, setDetectedMode] = useState<FlowMode>("standard");

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        body: () => (currentSessionId ? { sessionId: currentSessionId } : {}),
        fetch: async (url, init) => {
          const response = await globalThis.fetch(url, init);
          const sid = response.headers.get("X-Session-Id");
          if (sid && !currentSessionId) {
            currentSessionId = sid;
          }
          return response;
        },
      }),
  );

  const chatResult = useChat({
    transport,
    onError: (err: Error) => console.error("useChat error:", err),
  });

  const { messages, status, error, sendMessage, addToolOutput } = chatResult;

  const isLoading = status === "streaming" || status === "submitted";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const value = input;
    setInput("");

    if (messages.length === 0) {
      const mode = detectFlowMode(value);
      setDetectedMode(mode);
      sendMessage({ text: `[Mode: ${mode.toUpperCase()}] ${value}` });
    } else {
      sendMessage({ text: value });
    }
  };

  const handleApprove = useCallback(
    (taskId: string) => {
      console.log("Approved task:", taskId);
      const matchedPart = (messages as ChatMessage[])
        .flatMap((m) => m.parts ?? [])
        .find(
          (p) =>
            p.type === "tool-invocation" && p.toolInvocation?.toolCallId === taskId,
        );
      const command = matchedPart?.toolInvocation?.result?.command ?? "";

      fetch("/api/execute-approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          sessionId: currentSessionId ?? "",
          approvalToken: taskId,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          addToolOutput({
            tool: "execute_bash",
            toolCallId: taskId,
            output: data.error
              ? { error: data.error }
              : { stdout: data.stdout, stderr: data.stderr },
          });
        })
        .catch((err: Error) => {
          addToolOutput({
            tool: "execute_bash",
            toolCallId: taskId,
            state: "output-error",
            errorText: err.message || "Failed to execute",
          });
        });
    },
    [messages, addToolOutput],
  );

  const handleDeny = useCallback(
    (taskId: string) => {
      console.log("Denied task:", taskId);
      addToolOutput({
        tool: "execute_bash",
        toolCallId: taskId,
        state: "output-error",
        errorText: "Execution denied by user.",
      });
    },
    [addToolOutput],
  );

  return (
    <div className="flex flex-col h-full bg-background/95">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Ultron v3.0 — ULTRON-X
          </h1>
          <p className="text-sm text-muted-foreground">
            AI-powered autonomous penetration testing with Flow Engine + 13 specialist agents.
            {detectedMode !== "standard" && (
              <span className="ml-2 text-primary font-medium">[{detectedMode.toUpperCase()} MODE]</span>
            )}
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <ScrollArea className="flex-1 p-6 h-full">
            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-10">
              {/* Welcome Message */}
              {messages.length === 0 && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted/50 border p-5 rounded-lg rounded-tl-none flex-1 space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground mb-1">
                        Welcome to Ultron v3.0 — ULTRON-X
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Just describe what you want to do — Ultron will automatically detect the
                        attack mode and target from your message.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Card className="bg-background/50 border-primary/20 cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => { setInput("Run an nmap scan on scanme.nmap.org"); }}>
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <TerminalSquare className="w-4 h-4" />
                            Reconnaissance
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-1 text-xs text-muted-foreground">
                          &quot;Run an nmap scan on scanme.nmap.org&quot;
                        </CardContent>
                      </Card>
                      <Card className="bg-background/50 border-primary/20 cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => { setInput("Find hidden directories on example.com using gobuster"); }}>
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            Web Scanning
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-1 text-xs text-muted-foreground">
                          &quot;Find hidden directories on example.com using gobuster&quot;
                        </CardContent>
                      </Card>
                      <Card className="bg-background/50 border-primary/20 cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => { setInput("Solve this CTF challenge: find the hidden flag"); }}>
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            CTF Mode
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-1 text-xs text-muted-foreground">
                          &quot;Solve this CTF challenge: find the hidden flag&quot;
                        </CardContent>
                      </Card>
                      <Card className="bg-background/50 border-primary/20 cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => { setInput("Run a bug bounty recon on example.com"); }}>
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Bug Bounty
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-1 text-xs text-muted-foreground">
                          &quot;Run a bug bounty recon on example.com&quot;
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              {(messages as ChatMessage[]).map((m) => (
                <div key={m.id} className="flex gap-4">
                  {m.role === "user" ? (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-primary" />
                    </div>
                  )}

                  <div
                    className={`p-4 rounded-lg flex-1 overflow-x-auto ${
                      m.role === "user"
                        ? "bg-secondary/50 rounded-tr-none"
                        : "bg-muted/50 border rounded-tl-none"
                    }`}
                  >
                    {/* Render parts (AI SDK v6) */}
                    {m.parts && m.parts.length > 0 ? (
                      m.parts.map((part, index) => {
                        if (part.type === "text" && part.text) {
                          return (
                            <div key={`text-${index}`} className="text-sm prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {part.text}
                              </ReactMarkdown>
                            </div>
                          );
                        }
                        if (part.type === "tool-invocation" && part.toolInvocation) {
                          return (
                            <div key={part.toolInvocation.toolCallId ?? `tool-${index}`} className="mt-4">
                              <ToolInvocationDisplay
                                toolInvocation={part.toolInvocation}
                                onApprove={handleApprove}
                                onDeny={handleDeny}
                              />
                            </div>
                          );
                        }
                        return null;
                      })
                    ) : m.content ? (
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : null}

                    {/* Fallback for old toolInvocations array */}
                    {!m.parts && m.toolInvocations?.map((toolInvocation) => (
                      <div key={toolInvocation.toolCallId} className="mt-4">
                        <ToolInvocationDisplay
                          toolInvocation={toolInvocation}
                          onApprove={handleApprove}
                          onDeny={handleDeny}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                  <div className="bg-muted/50 border p-4 rounded-lg rounded-tl-none flex-1">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce"></div>
                      <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm font-mono">
                  Error: {error.message || "Unknown error occurred"}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 bg-background border-t shrink-0">
            <form onSubmit={onSubmit} className="max-w-4xl mx-auto relative flex items-center">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask Ultron to scan a target..."
                className="pr-12 py-6 text-base bg-muted/50 border-muted-foreground/20 focus-visible:ring-primary/50 rounded-xl"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input?.trim()}
                className="absolute right-2 rounded-lg bg-primary hover:bg-primary/90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
            <div className="text-center mt-2 text-xs text-muted-foreground">
              Ultron v3.0 can make mistakes. Always verify findings before reporting.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
