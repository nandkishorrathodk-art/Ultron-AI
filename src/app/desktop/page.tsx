"use client";

import { useState, useEffect } from "react";
import { Monitor, Maximize2, ZoomIn, ZoomOut, MousePointer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SandboxInfo {
  sessionId: string;
  sandboxId: string;
  ageSeconds: number;
}

export default function DesktopPage() {
  const [sandboxes, setSandboxes] = useState<SandboxInfo[]>([]);
  const [selectedSandbox, setSelectedSandbox] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    fetch("/api/sandboxes")
      .then((res) => res.json())
      .then((data) => {
        const sbs = data.sandboxes ?? [];
        setSandboxes(sbs);
        if (sbs.length > 0 && !selectedSandbox) {
          setSelectedSandbox(sbs[0].sessionId);
        }
      })
      .catch((err) => console.error("Failed to fetch sandboxes:", err))
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetch("/api/sandboxes")
        .then((res) => res.json())
        .then((data) => setSandboxes(data.sandboxes ?? []))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedSandbox]);

  return (
    <div className="flex flex-col h-full bg-background/95">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="w-6 h-6 text-primary" />
            Desktop
          </h1>
          <p className="text-sm text-muted-foreground">Watch and control Ultron&apos;s Desktop environment.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(50, zoom - 10))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
          <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(150, zoom + 10))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(100)}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sandbox Selector Sidebar */}
        <div className="w-64 border-r bg-card/30 p-4 shrink-0 overflow-y-auto">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Active VMs</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sandboxes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active sandboxes. Start a pentest session first.</p>
          ) : (
            <div className="space-y-2">
              {sandboxes.map((sb) => (
                <Card
                  key={sb.sessionId}
                  className={`cursor-pointer transition-colors ${
                    selectedSandbox === sb.sessionId ? "border-primary bg-primary/10" : "border-muted hover:border-primary/30"
                  }`}
                  onClick={() => setSelectedSandbox(sb.sessionId)}
                >
                  <CardContent className="p-3">
                    <p className="font-mono text-xs truncate">{sb.sessionId.substring(0, 12)}...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      VM: {sb.sandboxId.substring(0, 8)} • {Math.floor(sb.ageSeconds / 60)}m ago
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-green-400">Running</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Viewer */}
        <div className="flex-1 flex items-center justify-center bg-black/90 p-4">
          {selectedSandbox ? (
            <div
              className="w-full max-w-5xl aspect-video bg-gray-950 rounded-lg border border-muted/30 overflow-hidden relative"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center center" }}
            >
              {/* Simulated Desktop */}
              <div className="h-full flex flex-col">
                {/* Title Bar */}
                <div className="h-8 bg-gray-800 flex items-center px-3 gap-2 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-xs text-gray-400 ml-2 font-mono">
                    root@e2b-sandbox — {selectedSandbox.substring(0, 12)}
                  </span>
                </div>

                {/* Terminal Content */}
                <div className="flex-1 bg-gray-950 p-4 font-mono text-sm text-green-400 overflow-auto">
                  <div className="space-y-1">
                    <p className="text-gray-500">Last login: {new Date().toUTCString()}</p>
                    <p><span className="text-primary font-bold">root@e2b-sandbox:~#</span> <span className="text-white">whoami</span></p>
                    <p>root</p>
                    <p><span className="text-primary font-bold">root@e2b-sandbox:~#</span> <span className="text-white">ls /home/user/pentest/</span></p>
                    <p>findings.md  recon/  exploits/  reports/</p>
                    <p><span className="text-primary font-bold">root@e2b-sandbox:~#</span> <span className="text-white">cat /home/user/pentest/findings.md</span></p>
                    <p className="text-gray-400"># Ultron v3.0 Findings</p>
                    <p className="text-gray-400">Pentest session in progress...</p>
                    <p className="mt-2"><span className="text-primary font-bold">root@e2b-sandbox:~#</span> <span className="animate-pulse text-white">_</span></p>
                  </div>
                </div>

                {/* Status Bar */}
                <div className="h-6 bg-gray-800 flex items-center justify-between px-3 text-xs text-gray-500 shrink-0">
                  <div className="flex items-center gap-2">
                    <MousePointer className="w-3 h-3" />
                    <span>E2B Micro-VM</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>Debian 12</span>
                    <span>•</span>
                    <span className="text-green-400">Connected</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Card className="border-dashed border-muted p-12 text-center flex flex-col items-center justify-center gap-4 bg-muted/10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Monitor className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No Active Desktop</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  Start a pentest session to access Ultron&apos;s desktop environment. Select a VM from the sidebar to view its desktop.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
