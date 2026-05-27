"use client";

import { useEffect, useState } from "react";
import { ClipboardList, TerminalSquare, FileText, FileEdit, Globe, Package, Bot, Play, CheckCircle, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface WorklogEntry {
  id: string;
  sessionId: string;
  action: string;
  summary: string;
  details?: string;
  status: "success" | "error" | "pending" | "running";
  timestamp: number;
}

const actionConfig: Record<string, { icon: typeof TerminalSquare; color: string; label: string }> = {
  command: { icon: TerminalSquare, color: "text-green-400", label: "Command" },
  file_read: { icon: FileText, color: "text-blue-400", label: "File Read" },
  file_write: { icon: FileEdit, color: "text-yellow-400", label: "File Write" },
  web_search: { icon: Globe, color: "text-purple-400", label: "Web Search" },
  tool_install: { icon: Package, color: "text-cyan-400", label: "Install" },
  agent_spawn: { icon: Bot, color: "text-orange-400", label: "Agent Spawn" },
  flow_start: { icon: Play, color: "text-primary", label: "Flow Start" },
  flow_complete: { icon: CheckCircle, color: "text-green-500", label: "Flow Complete" },
  approval_request: { icon: AlertTriangle, color: "text-yellow-500", label: "Approval Required" },
  approval_granted: { icon: CheckCircle, color: "text-green-400", label: "Approved" },
  approval_denied: { icon: XCircle, color: "text-red-400", label: "Denied" },
};

const statusStyles: Record<string, string> = {
  success: "text-green-400 bg-green-500/10",
  error: "text-red-400 bg-red-500/10",
  pending: "text-yellow-400 bg-yellow-500/10",
  running: "text-blue-400 bg-blue-500/10",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function WorklogPage() {
  const [entries, setEntries] = useState<WorklogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchWorklog = () => {
    fetch("/api/session/worklog")
      .then((res) => res.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch((err) => console.error("Failed to fetch worklog:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWorklog();
    const interval = setInterval(fetchWorklog, 3000);
    return () => clearInterval(interval);
  }, []);

  const successCount = entries.filter((e) => e.status === "success").length;
  const errorCount = entries.filter((e) => e.status === "error").length;

  return (
    <div className="flex flex-col h-full bg-background/95">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Worklog
          </h1>
          <p className="text-sm text-muted-foreground">Understand Ultron&apos;s history and actions.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchWorklog}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/50 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-500" />
                  Total Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{entries.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Successful
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-400">{successCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-400">{errorCount}</div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading worklog...</p>
            </div>
          ) : entries.length === 0 ? (
            <Card className="border-dashed border-muted p-12 text-center flex flex-col items-center justify-center gap-4 bg-muted/10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ClipboardList className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No Activity Yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  Start a pentest session to see Ultron&apos;s complete activity history here.
                </p>
              </div>
            </Card>
          ) : (
            <div className="relative">
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-muted/30" />
              <div className="space-y-3">
                {entries.map((entry) => {
                  const config = actionConfig[entry.action] ?? actionConfig.command;
                  const Icon = config.icon;
                  const isExpanded = expandedId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className="relative pl-12 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <div className={`absolute left-[11px] top-3 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${statusStyles[entry.status] ?? statusStyles.pending}`}>
                        <div className="w-2 h-2 rounded-full bg-current" />
                      </div>
                      <Card className="border-muted/50 bg-background/50 hover:border-primary/30 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 ${config.color} shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{entry.summary}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">{formatTime(entry.timestamp)}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${statusStyles[entry.status]}`}>{entry.status}</span>
                                <span className="text-xs text-muted-foreground/60">{config.label}</span>
                              </div>
                            </div>
                          </div>
                          {isExpanded && entry.details && (
                            <div className="mt-2 bg-black/80 rounded-md p-3 font-mono text-xs text-green-400 max-h-48 overflow-auto whitespace-pre-wrap">
                              {entry.details}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
