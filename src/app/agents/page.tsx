"use client";

import { useEffect, useState } from "react";
import { Bot, RefreshCw, Clock, CheckCircle, XCircle, Loader2, TerminalSquare, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface AgentSession {
  id: string;
  parentSessionId: string;
  agentRole: string;
  status: "running" | "completed" | "failed" | "idle";
  taskDescription: string;
  startedAt: number;
  completedAt?: number;
  commandCount: number;
  lastActivity?: string;
}

const statusConfig = {
  running: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", animate: "animate-spin" },
  completed: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", animate: "" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", animate: "" },
  idle: { icon: Pause, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", animate: "" },
};

const roleColors: Record<string, string> = {
  recon: "text-blue-400",
  exploit: "text-red-400",
  web: "text-purple-400",
  network: "text-cyan-400",
  crypto: "text-yellow-400",
  forensics: "text-green-400",
  social: "text-orange-400",
  wireless: "text-pink-400",
  cloud: "text-indigo-400",
  mobile: "text-teal-400",
  report: "text-gray-400",
  coordinator: "text-primary",
  escalation: "text-red-500",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(startMs: number, endMs?: number): string {
  const diff = (endMs ?? Date.now()) - startMs;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = () => {
    fetch("/api/session/agents")
      .then((res) => res.json())
      .then((data) => setAgents(data.agents ?? []))
      .catch((err) => console.error("Failed to fetch agents:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 3000);
    return () => clearInterval(interval);
  }, []);

  const runningCount = agents.filter((a) => a.status === "running").length;
  const completedCount = agents.filter((a) => a.status === "completed").length;
  const failedCount = agents.filter((a) => a.status === "failed").length;

  return (
    <div className="flex flex-col h-full bg-background/95">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Agents
          </h1>
          <p className="text-sm text-muted-foreground">View child sessions started by this session.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchAgents}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  Total Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{agents.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-400" />
                  Running
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-400">{runningCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-400">{completedCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-400">{failedCount}</div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading agent sessions...</p>
            </div>
          ) : agents.length === 0 ? (
            <Card className="border-dashed border-muted p-12 text-center flex flex-col items-center justify-center gap-4 bg-muted/10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Bot className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No Agent Sessions</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  When Ultron spawns specialist agents (recon, exploit, web, etc.), they will appear here. Start a complex pentest to see agents in action.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => {
                const config = statusConfig[agent.status];
                const StatusIcon = config.icon;
                const roleColor = roleColors[agent.agentRole] ?? "text-muted-foreground";

                return (
                  <Card key={agent.id} className={`${config.border} bg-background/50`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center`}>
                            <StatusIcon className={`w-5 h-5 ${config.color} ${config.animate}`} />
                          </div>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <span className={`font-semibold ${roleColor}`}>{agent.agentRole}</span>
                              <span className="text-muted-foreground font-normal">Agent</span>
                            </CardTitle>
                            <CardDescription className="font-mono text-xs mt-0.5">
                              ID: {agent.id} • Parent: {agent.parentSessionId.substring(0, 8)}...
                            </CardDescription>
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${config.bg} ${config.color} font-medium`}>
                          {agent.status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{agent.taskDescription}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Started {formatTime(agent.startedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <TerminalSquare className="w-3 h-3" />
                          {agent.commandCount} commands
                        </span>
                        <span>Duration: {formatDuration(agent.startedAt, agent.completedAt)}</span>
                        {agent.lastActivity && (
                          <span className="truncate max-w-xs">Last: {agent.lastActivity}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
