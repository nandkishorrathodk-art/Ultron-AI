"use client";

import { useState, useEffect } from "react";
import { Monitor, Maximize2, ZoomIn, ZoomOut, MousePointer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DesktopSimulator } from "@/components/DesktopSimulator";

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
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sandboxes")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const sbs = data.sandboxes ?? [];
        setSandboxes(sbs);
        if (sbs.length > 0) {
          setSelectedSandbox((prev) => prev ?? sbs[0].sessionId);
        }
      })
      .catch((err) => console.error("Failed to fetch sandboxes:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const interval = setInterval(() => {
      fetch("/api/sandboxes")
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setSandboxes(data.sandboxes ?? []);
        })
        .catch(() => {});
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Fetch stream URL for selected sandbox
  useEffect(() => {
    if (!selectedSandbox) {
      setStreamUrl(null);
      return;
    }

    let active = true;
    const checkStream = () => {
      fetch(`/api/desktop/stream?sessionId=${selectedSandbox}`)
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          if (data.success && data.streamUrl) {
            setStreamUrl(data.streamUrl);
          } else {
            setStreamUrl(null);
          }
        })
        .catch(() => {
          if (active) setStreamUrl(null);
        });
    };

    checkStream();
    const interval = setInterval(checkStream, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedSandbox]);

  const handleLaunchDesktop = async () => {
    if (!selectedSandbox) return;
    setLaunching(true);
    try {
      const res = await fetch(`/api/desktop/stream?sessionId=${selectedSandbox}&init=true`);
      const data = await res.json();
      if (data.success && data.streamUrl) {
        setStreamUrl(data.streamUrl);
      }
    } catch (err) {
      console.error("[Ultron] Launch failed:", err);
    } finally {
      setLaunching(false);
    }
  };

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
        <div className="flex-1 flex flex-col items-center justify-center bg-black/90 p-4 overflow-auto">
          {selectedSandbox ? (
            <div className="w-full max-w-5xl flex flex-col gap-4">
              <div className="flex justify-between items-center bg-card/40 p-3 rounded-lg border border-border/60 shrink-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${streamUrl ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
                  <span className="text-xs md:text-sm font-medium">
                    {streamUrl ? "Streaming Live E2B GUI Desktop" : "Simulated UI (Spawn a real E2B Desktop VM to stream below)"}
                  </span>
                </div>
                {!streamUrl && (
                  <Button
                    onClick={handleLaunchDesktop}
                    disabled={launching}
                    size="sm"
                    className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-4 rounded-md shadow-lg transition duration-200"
                  >
                    {launching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                        Spawning GUI VM...
                      </>
                    ) : (
                      "Spawn Live GUI VM"
                    )}
                  </Button>
                )}
              </div>
              <div
                className="w-full aspect-video rounded-lg overflow-hidden relative border border-border/80 shadow-2xl bg-black"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
              >
                {streamUrl ? (
                  <iframe
                    src={streamUrl}
                    className="w-full h-full border-0"
                    allow="autoplay; encrypted-media; fullscreen"
                  />
                ) : (
                  <DesktopSimulator sessionId={selectedSandbox} />
                )}
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
