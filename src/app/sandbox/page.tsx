"use client";

import { useEffect, useState } from "react";
import { Terminal, Server, ShieldAlert, Cpu, RefreshCw, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface SandboxLog {
  command: string;
  output: string;
  timestamp: number;
}

interface SandboxSession {
  sessionId: string;
  sandboxId: string;
  ageSeconds: number;
  logs: SandboxLog[];
}

export default function SandboxPage() {
  const [sandboxes, setSandboxes] = useState<SandboxSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSandboxes = async (isRefresh: boolean) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/sandboxes");
      const data = await res.json();
      if (data.sandboxes) {
        setSandboxes(data.sandboxes);
      }
    } catch (err) {
      console.error("Failed to fetch sandboxes:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sandboxes")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.sandboxes) {
          setSandboxes(data.sandboxes);
        }
      })
      .catch((err) => console.error("Failed to fetch sandboxes:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const interval = setInterval(() => {
      fetchSandboxes(true);
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-background/95">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Terminal className="w-6 h-6 text-primary" />
            Agent Sandbox Monitor
          </h1>
          <p className="text-sm text-muted-foreground">Monitor and manage active E2B micro-VM instances in real-time.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-primary/20 hover:bg-primary/10"
          onClick={() => fetchSandboxes(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card/50 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-500" />
                  Active Instances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sandboxes.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-green-500" />
                  Compute Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sandboxes.length > 0 ? "12%" : "0%"}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  Active Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sandboxes.length}</div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-muted-foreground">Loading active sandbox instances...</p>
            </div>
          ) : sandboxes.length === 0 ? (
            /* Empty State */
            <Card className="border-dashed border-muted p-12 text-center flex flex-col items-center justify-center gap-4 bg-muted/10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                <Layers className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No Active Sandboxes</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  There are no running E2B micro-VM instances right now. Start a new pentest session in the chat to spin up a persistent, secure Debian container!
                </p>
              </div>
            </Card>
          ) : (
            /* Active Sandboxes List */
            sandboxes.map((box) => (
              <Card key={box.sessionId} className="border-primary/20 bg-background/50 backdrop-blur-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-mono text-base flex items-center gap-2">
                        <span className="text-primary">Session:</span> {box.sessionId.substring(0, 15)}...
                      </CardTitle>
                      <CardDescription className="font-mono text-xs mt-1">
                        E2B VM ID: <span className="text-muted-foreground">{box.sandboxId}</span> • Age: {Math.floor(box.ageSeconds / 60)}m {box.ageSeconds % 60}s
                      </CardDescription>
                    </div>
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-green-500 border-green-500 bg-green-500/10">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                      Running
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-black/90 border border-muted p-4 rounded-md font-mono text-sm text-green-400 overflow-x-auto max-h-96 overflow-y-auto space-y-4 animate-fadeIn">
                    {!box.logs || box.logs.length === 0 ? (
                      <div className="text-muted-foreground italic text-xs animate-pulse">
                        Waiting for commands to be executed...
                      </div>
                    ) : (
                      box.logs.map((log, index) => (
                        <div key={index} className="border-b border-muted/20 pb-3 last:border-0 last:pb-0">
                          <p className="text-blue-400 flex items-center gap-2">
                            <span className="text-primary font-bold">root@e2b-sandbox:~#</span> {log.command}
                          </p>
                          <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed pl-4">
                            {log.output}
                          </pre>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
