"use client";

import { useEffect, useState, useRef } from "react";
import { TerminalSquare, RefreshCw, Clock, CheckCircle, XCircle, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface ShellEntry {
  id: string;
  sessionId: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timestamp: number;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ShellPage() {
  const [commands, setCommands] = useState<ShellEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchShell = () => {
    fetch("/api/session/shell")
      .then((res) => res.json())
      .then((data) => {
        const sorted = (data.commands ?? []).sort((a: ShellEntry, b: ShellEntry) => a.timestamp - b.timestamp);
        setCommands(sorted);
      })
      .catch((err) => console.error("Failed to fetch shell:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchShell();
    const interval = setInterval(fetchShell, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [commands.length, autoScroll]);

  const successCount = commands.filter((c) => c.exitCode === 0).length;
  const failCount = commands.filter((c) => c.exitCode !== null && c.exitCode !== 0).length;
  const totalDuration = commands.reduce((sum, c) => sum + c.durationMs, 0);

  return (
    <div className="flex flex-col h-full bg-background/95">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TerminalSquare className="w-6 h-6 text-primary" />
            Shell
          </h1>
          <p className="text-sm text-muted-foreground">View Ultron&apos;s command history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoScroll ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setAutoScroll(!autoScroll)}
          >
            Auto-scroll {autoScroll ? "ON" : "OFF"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchShell}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TerminalSquare className="w-4 h-4 text-blue-500" />
                  Commands
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{commands.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Success
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
                  Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-400">{failCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Timer className="w-4 h-4 text-yellow-500" />
                  Total Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatDuration(totalDuration)}</div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading command history...</p>
            </div>
          ) : commands.length === 0 ? (
            <Card className="border-dashed border-muted p-12 text-center flex flex-col items-center justify-center gap-4 bg-muted/10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <TerminalSquare className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No Commands Executed</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  Start a pentest session to see all shell commands executed by Ultron here.
                </p>
              </div>
            </Card>
          ) : (
            <div className="bg-gray-950 rounded-lg border border-muted/30 overflow-hidden">
              <div className="h-8 bg-gray-800 flex items-center px-3 gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-xs text-gray-400 font-mono">Ultron Shell — {commands.length} commands</span>
              </div>
              <div className="p-4 font-mono text-sm space-y-4 max-h-[600px] overflow-auto">
                {commands.map((cmd) => (
                  <div key={cmd.id} className="group">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-bold shrink-0">root@e2b:~#</span>
                      <span className="text-white">{cmd.command}</span>
                      <span className="ml-auto text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {formatTime(cmd.timestamp)}
                        <span className="text-gray-500">•</span>
                        {formatDuration(cmd.durationMs)}
                        {cmd.exitCode !== null && cmd.exitCode !== 0 && (
                          <span className="text-red-400">exit {cmd.exitCode}</span>
                        )}
                      </span>
                    </div>
                    {cmd.stdout && (
                      <pre className="text-green-400/80 text-xs mt-1 whitespace-pre-wrap pl-4 max-h-40 overflow-auto">
                        {cmd.stdout}
                      </pre>
                    )}
                    {cmd.stderr && (
                      <pre className="text-red-400/80 text-xs mt-1 whitespace-pre-wrap pl-4 max-h-20 overflow-auto">
                        {cmd.stderr}
                      </pre>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
