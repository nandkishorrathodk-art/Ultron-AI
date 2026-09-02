"use client";

import { useEffect, useState } from "react";
import { FileEdit, FileText, FilePlus, Trash2, RefreshCw, Clock, FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface FileChange {
  id: string;
  sessionId: string;
  path: string;
  operation: "read" | "write" | "create" | "delete";
  content?: string;
  bytes?: number;
  timestamp: number;
}

const operationConfig = {
  read: { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10", label: "Read" },
  write: { icon: FileEdit, color: "text-yellow-400", bg: "bg-yellow-500/10", label: "Modified" },
  create: { icon: FilePlus, color: "text-green-400", bg: "bg-green-500/10", label: "Created" },
  delete: { icon: Trash2, color: "text-red-400", bg: "bg-red-500/10", label: "Deleted" },
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function ChangesPage() {
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchChanges = () => {
    fetch("/api/session/changes")
      .then((res) => res.json())
      .then((data) => setChanges(data.changes ?? []))
      .catch((err) => console.error("Failed to fetch changes:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchChanges();
    const interval = setInterval(fetchChanges, 3000);
    return () => clearInterval(interval);
  }, []);

  const uniqueFiles = new Set(changes.map((c) => c.path)).size;
  const writeCount = changes.filter((c) => c.operation === "write" || c.operation === "create").length;

  return (
    <div className="flex flex-col h-full bg-background/95">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileEdit className="w-6 h-6 text-primary" />
            Changes
          </h1>
          <p className="text-sm text-muted-foreground">See Ultron&apos;s file edits across all sessions.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchChanges}>
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
                  <FolderOpen className="w-4 h-4 text-blue-500" />
                  Files Touched
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{uniqueFiles}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-yellow-500" />
                  Total Edits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{writeCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  Total Operations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{changes.length}</div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading file changes...</p>
            </div>
          ) : changes.length === 0 ? (
            <Card className="border-dashed border-muted p-12 text-center flex flex-col items-center justify-center gap-4 bg-muted/10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileEdit className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No File Changes Yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  Start a pentest session to see Ultron&apos;s file edits here. Every read, write, and create operation will be tracked.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {changes.map((change) => {
                const config = operationConfig[change.operation];
                const Icon = config.icon;
                const isExpanded = expandedId === change.id;
                return (
                  <Card
                    key={change.id}
                    className="border-muted/50 bg-background/50 cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : change.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-md ${config.bg} flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm truncate">{change.path}</p>
                          <p className="text-xs text-muted-foreground">
                            {config.label} • {formatTime(change.timestamp)}
                            {change.bytes ? ` • ${change.bytes} bytes` : ""}
                            <span className="ml-2 text-muted-foreground/60">Session: {change.sessionId.substring(0, 8)}...</span>
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      {isExpanded && change.content && (
                        <div className="mt-3 bg-black/80 rounded-md p-3 font-mono text-xs text-green-400 max-h-64 overflow-auto whitespace-pre-wrap">
                          {change.content}
                        </div>
                      )}
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
