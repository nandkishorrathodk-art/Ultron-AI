"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileEdit,
  ClipboardList,
  Monitor,
  TerminalSquare,
  Code,
  Bot,
  X,
  Maximize2,
  Minimize2,
  FileText,
  FilePlus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Pause,
  Clock,
  ChevronRight,
  MousePointer,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileChange {
  id: string;
  sessionId: string;
  path: string;
  operation: "read" | "write" | "create" | "delete";
  content?: string;
  bytes?: number;
  timestamp: number;
}

interface WorklogEntry {
  id: string;
  sessionId: string;
  action: string;
  summary: string;
  details?: string;
  status: "success" | "error" | "pending" | "running";
  timestamp: number;
}

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

interface IDEFile {
  path: string;
  content: string;
  language: string;
  lastModified: number;
}

interface SandboxInfo {
  sessionId: string;
  sandboxId: string;
  ageSeconds: number;
}

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

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = "worklog" | "changes" | "desktop" | "shell" | "ide" | "agents";

const TABS: { id: TabId; label: string; icon: typeof FileEdit }[] = [
  { id: "worklog", label: "Worklog", icon: ClipboardList },
  { id: "changes", label: "Changes", icon: FileEdit },
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "shell", label: "Shell", icon: TerminalSquare },
  { id: "ide", label: "IDE", icon: Code },
  { id: "agents", label: "Agents", icon: Bot },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function getFileIcon(language: string): string {
  const iconMap: Record<string, string> = {
    typescript: "🟦",
    javascript: "🟨",
    python: "🐍",
    rust: "🦀",
    go: "🐹",
    bash: "🖥️",
    markdown: "📝",
    json: "📋",
    yaml: "⚙️",
    html: "🌐",
    css: "🎨",
    plaintext: "📄",
  };
  return iconMap[language] ?? "📄";
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function WorklogPanel() {
  const [entries, setEntries] = useState<WorklogEntry[]>([]);

  useEffect(() => {
    const fetchWorklog = () => {
      fetch("/api/session/worklog")
        .then((r) => r.json())
        .then((d) => setEntries(d.entries ?? []))
        .catch(() => {});
    };
    fetchWorklog();
    const interval = setInterval(fetchWorklog, 3000);
    return () => clearInterval(interval);
  }, []);

  const statusIcon: Record<string, typeof CheckCircle> = {
    success: CheckCircle,
    error: XCircle,
    pending: Clock,
    running: Loader2,
  };
  const statusColor: Record<string, string> = {
    success: "text-green-400",
    error: "text-red-400",
    pending: "text-yellow-400",
    running: "text-blue-400",
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
        <ClipboardList className="w-8 h-8 opacity-40" />
        <p className="text-sm">No activity yet</p>
        <p className="text-xs opacity-60">Start a pentest to see actions here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {entries.map((entry) => {
        const Icon = statusIcon[entry.status] ?? Clock;
        const color = statusColor[entry.status] ?? "text-muted-foreground";
        return (
          <div
            key={entry.id}
            className="flex items-start gap-2 p-2 rounded hover:bg-muted/30 transition-colors"
          >
            <Icon
              className={`w-4 h-4 mt-0.5 shrink-0 ${color} ${entry.status === "running" ? "animate-spin" : ""}`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{entry.summary}</p>
              <p className="text-xs text-muted-foreground">
                {formatTime(entry.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const operationConfig = {
  read: { icon: FileText, color: "text-blue-400", label: "Read" },
  write: { icon: FileEdit, color: "text-yellow-400", label: "Modified" },
  create: { icon: FilePlus, color: "text-green-400", label: "Created" },
  delete: { icon: Trash2, color: "text-red-400", label: "Deleted" },
};

function ChangesPanel() {
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchChanges = () => {
      fetch("/api/session/changes")
        .then((r) => r.json())
        .then((d) => setChanges(d.changes ?? []))
        .catch(() => {});
    };
    fetchChanges();
    const interval = setInterval(fetchChanges, 3000);
    return () => clearInterval(interval);
  }, []);

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
        <FileEdit className="w-8 h-8 opacity-40" />
        <p className="text-sm">No file changes yet</p>
        <p className="text-xs opacity-60">File edits will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {changes.map((change) => {
        const config = operationConfig[change.operation];
        const Icon = config.icon;
        const isExpanded = expandedId === change.id;
        return (
          <div key={change.id}>
            <div
              className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : change.id)}
            >
              <Icon className={`w-4 h-4 shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono truncate">{change.path}</p>
                <p className="text-xs text-muted-foreground">
                  {config.label} • {formatTime(change.timestamp)}
                </p>
              </div>
            </div>
            {isExpanded && change.content && (
              <div className="mx-2 mb-1 bg-black/80 rounded p-2 font-mono text-xs text-green-400 max-h-40 overflow-auto whitespace-pre-wrap">
                {change.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DesktopPanel() {
  const [sandboxes, setSandboxes] = useState<SandboxInfo[]>([]);
  const [selectedSandbox, setSelectedSandbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sandboxes")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const sbs = d.sandboxes ?? [];
        setSandboxes(sbs);
        if (sbs.length > 0) {
          setSelectedSandbox((prev) => prev ?? sbs[0].sessionId);
        }
      })
      .catch(() => {});

    const interval = setInterval(() => {
      fetch("/api/sandboxes")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setSandboxes(d.sandboxes ?? []);
        })
        .catch(() => {});
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (sandboxes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
        <Monitor className="w-8 h-8 opacity-40" />
        <p className="text-sm">No active desktop</p>
        <p className="text-xs opacity-60">Start a pentest to access VMs</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* VM list */}
      <div className="p-2 border-b space-y-1">
        {sandboxes.map((sb) => (
          <div
            key={sb.sessionId}
            className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${
              selectedSandbox === sb.sessionId
                ? "bg-primary/10 border border-primary/30"
                : "hover:bg-muted/30"
            }`}
            onClick={() => setSelectedSandbox(sb.sessionId)}
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-mono truncate">
              {sb.sessionId.substring(0, 12)}...
            </span>
            <span className="text-muted-foreground ml-auto">
              {Math.floor(sb.ageSeconds / 60)}m
            </span>
          </div>
        ))}
      </div>

      {/* Desktop viewer */}
      {selectedSandbox && (
        <div className="flex-1 bg-gray-950 p-3 font-mono text-xs text-green-400 overflow-auto">
          <p className="text-gray-500">
            Last login: {new Date().toUTCString()}
          </p>
          <p>
            <span className="text-primary font-bold">
              root@e2b-sandbox:~#
            </span>{" "}
            <span className="text-white">whoami</span>
          </p>
          <p>root</p>
          <p className="mt-1">
            <span className="text-primary font-bold">
              root@e2b-sandbox:~#
            </span>{" "}
            <span className="animate-pulse text-white">_</span>
          </p>
          <div className="mt-3 flex items-center gap-2 text-gray-500 text-xs">
            <MousePointer className="w-3 h-3" />
            <span>E2B Micro-VM</span>
            <span>•</span>
            <span>Debian 12</span>
            <span>•</span>
            <span className="text-green-400">Connected</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ShellPanel() {
  const [commands, setCommands] = useState<ShellEntry[]>([]);

  useEffect(() => {
    const fetchShell = () => {
      fetch("/api/session/shell")
        .then((r) => r.json())
        .then((d) => {
          const sorted = (d.commands ?? []).sort(
            (a: ShellEntry, b: ShellEntry) => a.timestamp - b.timestamp,
          );
          setCommands(sorted);
        })
        .catch(() => {});
    };
    fetchShell();
    const interval = setInterval(fetchShell, 2000);
    return () => clearInterval(interval);
  }, []);

  if (commands.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
        <TerminalSquare className="w-8 h-8 opacity-40" />
        <p className="text-sm">No commands executed</p>
        <p className="text-xs opacity-60">Command history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2 font-mono">
      {commands.map((cmd) => (
        <div
          key={cmd.id}
          className="p-2 rounded hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-primary text-xs font-bold">$</span>
            <span className="text-xs text-white truncate flex-1">
              {cmd.command}
            </span>
            <span
              className={`text-xs ${cmd.exitCode === 0 ? "text-green-400" : "text-red-400"}`}
            >
              {cmd.exitCode === 0 ? "✓" : `✗ ${cmd.exitCode}`}
            </span>
          </div>
          {cmd.stdout && (
            <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-20 overflow-auto">
              {cmd.stdout.substring(0, 500)}
            </pre>
          )}
          {cmd.stderr && (
            <pre className="mt-1 text-xs text-red-400/70 whitespace-pre-wrap break-all max-h-20 overflow-auto">
              {cmd.stderr.substring(0, 300)}
            </pre>
          )}
          <p className="text-xs text-muted-foreground/60 mt-1">
            {formatTime(cmd.timestamp)} • {formatDuration(cmd.durationMs)}
          </p>
        </div>
      ))}
    </div>
  );
}

function IDEPanel() {
  const [files, setFiles] = useState<IDEFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<IDEFile | null>(null);

  const fetchFiles = useCallback(() => {
    fetch("/api/session/ide")
      .then((r) => r.json())
      .then((d) => {
        const f = d.files ?? [];
        setFiles(f);
        if (f.length > 0) {
          setSelectedFile((prev) => prev ?? f[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, 5000);
    return () => clearInterval(interval);
  }, [fetchFiles]);

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
        <Code className="w-8 h-8 opacity-40" />
        <p className="text-sm">No files accessed</p>
        <p className="text-xs opacity-60">Sandbox files will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* File list */}
      <div className="border-b p-1 max-h-32 overflow-auto">
        {files.map((file) => (
          <button
            key={file.path}
            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
              selectedFile?.path === file.path
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted/50"
            }`}
            onClick={() => setSelectedFile(file)}
          >
            <span>{getFileIcon(file.language)}</span>
            <span className="font-mono truncate">{getFileName(file.path)}</span>
            <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>

      {/* File content */}
      {selectedFile ? (
        <div className="flex-1 overflow-auto">
          <div className="px-2 py-1 border-b bg-gray-900 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{getFileIcon(selectedFile.language)}</span>
            <span className="font-mono truncate">
              {getFileName(selectedFile.path)}
            </span>
            <span className="ml-auto">{selectedFile.language}</span>
          </div>
          <pre className="p-3 font-mono text-xs text-green-400/90 whitespace-pre overflow-x-auto leading-5">
            {selectedFile.content}
          </pre>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
          Select a file
        </div>
      )}
    </div>
  );
}

const agentStatusConfig = {
  running: {
    icon: Loader2,
    color: "text-blue-400",
    animate: "animate-spin",
  },
  completed: { icon: CheckCircle, color: "text-green-400", animate: "" },
  failed: { icon: XCircle, color: "text-red-400", animate: "" },
  idle: { icon: Pause, color: "text-yellow-400", animate: "" },
};

function AgentsPanel() {
  const [agents, setAgents] = useState<AgentSession[]>([]);

  useEffect(() => {
    const fetchAgents = () => {
      fetch("/api/session/agents")
        .then((r) => r.json())
        .then((d) => setAgents(d.agents ?? []))
        .catch(() => {});
    };
    fetchAgents();
    const interval = setInterval(fetchAgents, 3000);
    return () => clearInterval(interval);
  }, []);

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
        <Bot className="w-8 h-8 opacity-40" />
        <p className="text-sm">No agent sessions</p>
        <p className="text-xs opacity-60">Child agents will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {agents.map((agent) => {
        const config = agentStatusConfig[agent.status];
        const Icon = config.icon;
        return (
          <div
            key={agent.id}
            className="flex items-start gap-2 p-2 rounded hover:bg-muted/30 transition-colors"
          >
            <Icon
              className={`w-4 h-4 mt-0.5 shrink-0 ${config.color} ${config.animate}`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">
                <span className="capitalize">{agent.agentRole}</span> Agent
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {agent.taskDescription}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {formatTime(agent.startedAt)} • {agent.commandCount} cmds
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main MonitorPanel ────────────────────────────────────────────────────────

interface MonitorPanelProps {
  onClose: () => void;
}

export function MonitorPanel({ onClose }: MonitorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("worklog");
  const [expanded, setExpanded] = useState(false);

  const panelContent: Record<TabId, React.ReactNode> = {
    worklog: <WorklogPanel />,
    changes: <ChangesPanel />,
    desktop: <DesktopPanel />,
    shell: <ShellPanel />,
    ide: <IDEPanel />,
    agents: <AgentsPanel />,
  };

  return (
    <div
      className={`flex flex-col border-l bg-background h-full transition-all ${
        expanded ? "w-[60%]" : "w-[420px]"
      }`}
    >
      {/* Tab bar */}
      <div className="flex items-center border-b bg-muted/30 shrink-0">
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Panel controls */}
        <div className="flex items-center gap-1 px-2 shrink-0">
          <button
            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Minimize" : "Maximize"}
          >
            {expanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
            title="Close panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1">
        {panelContent[activeTab]}
      </ScrollArea>
    </div>
  );
}
