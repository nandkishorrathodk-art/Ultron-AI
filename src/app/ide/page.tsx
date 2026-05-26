"use client";

import { useEffect, useState, useCallback } from "react";
import { Code, FolderTree, RefreshCw, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface IDEFile {
  path: string;
  content: string;
  language: string;
  lastModified: number;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function getFileIcon(language: string): string {
  const iconMap: Record<string, string> = {
    typescript: "🟦", javascript: "🟨", python: "🐍", rust: "🦀",
    go: "🐹", ruby: "💎", bash: "🖥️", markdown: "📝",
    json: "📋", yaml: "⚙️", html: "🌐", css: "🎨",
    sql: "🗃️", plaintext: "📄",
  };
  return iconMap[language] ?? "📄";
}

export default function IDEPage() {
  const [files, setFiles] = useState<IDEFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<IDEFile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(() => {
    fetch("/api/session/ide")
      .then((res) => res.json())
      .then((data) => {
        const f = data.files ?? [];
        setFiles(f);
        if (f.length > 0 && !selectedFile) {
          setSelectedFile(f[0]);
        }
      })
      .catch((err) => console.error("Failed to fetch files:", err))
      .finally(() => setLoading(false));
  }, [selectedFile]);

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, 5000);
    return () => clearInterval(interval);
  }, [fetchFiles]);

  return (
    <div className="flex flex-col h-full bg-background/95">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Code className="w-6 h-6 text-primary" />
            IDE
          </h1>
          <p className="text-sm text-muted-foreground">Full control of Ultron&apos;s machine — browse and view sandbox files.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchFiles}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* File Tree */}
        <div className="w-72 border-r bg-card/30 flex flex-col shrink-0">
          <div className="p-3 border-b flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Explorer</span>
            <span className="ml-auto text-xs text-muted-foreground">{files.length} files</span>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : files.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">
                No files accessed yet. Start a pentest session to view sandbox files.
              </div>
            ) : (
              <div className="p-1">
                {files.map((file) => (
                  <button
                    key={file.path}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                      selectedFile?.path === file.path
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <span className="text-base">{getFileIcon(file.language)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-mono text-xs">{getFileName(file.path)}</p>
                      <p className="truncate text-xs text-muted-foreground">{file.path}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col bg-gray-950">
          {selectedFile ? (
            <>
              {/* Editor Tabs */}
              <div className="h-9 bg-gray-900 flex items-center px-2 border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-1 px-3 py-1 bg-gray-950 rounded-t-md border border-gray-800 border-b-0 text-xs">
                  <span>{getFileIcon(selectedFile.language)}</span>
                  <span className="text-foreground font-mono">{getFileName(selectedFile.path)}</span>
                </div>
                <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
                  <span>{selectedFile.language}</span>
                  <span>•</span>
                  <span>Modified {formatTime(selectedFile.lastModified)}</span>
                </div>
              </div>

              {/* Code Content */}
              <ScrollArea className="flex-1">
                <div className="flex">
                  {/* Line Numbers */}
                  <div className="px-3 py-4 text-right select-none shrink-0 bg-gray-950 border-r border-gray-800">
                    {selectedFile.content.split("\n").map((_, i) => (
                      <div key={i} className="text-xs text-gray-600 font-mono leading-5">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  {/* Code */}
                  <pre className="p-4 font-mono text-sm text-green-400/90 whitespace-pre overflow-x-auto flex-1 leading-5">
                    {selectedFile.content}
                  </pre>
                </div>
              </ScrollArea>

              {/* Status Bar */}
              <div className="h-6 bg-gray-800 flex items-center justify-between px-3 text-xs text-gray-500 shrink-0">
                <div className="flex items-center gap-3">
                  <span>{selectedFile.language}</span>
                  <span>•</span>
                  <span>{selectedFile.content.split("\n").length} lines</span>
                  <span>•</span>
                  <span>{selectedFile.content.length} chars</span>
                </div>
                <span>UTF-8</span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Card className="border-dashed border-muted p-12 text-center flex flex-col items-center justify-center gap-4 bg-muted/10">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Code className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">No File Selected</h3>
                  <p className="text-sm text-muted-foreground max-w-md mt-1">
                    Select a file from the explorer to view its content, or start a pentest to populate files.
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
