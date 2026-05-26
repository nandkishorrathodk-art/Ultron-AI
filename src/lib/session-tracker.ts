/**
 * ULTRON v3.0 — Session Tracker
 *
 * Tracks all session activities: file changes, command history,
 * worklog entries, and agent (child) sessions.
 * In-memory store — same caveats as sandbox-manager.ts.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileChange {
  id: string;
  sessionId: string;
  path: string;
  operation: "read" | "write" | "create" | "delete";
  content?: string;
  bytes?: number;
  timestamp: number;
}

export interface WorklogEntry {
  id: string;
  sessionId: string;
  action: "command" | "file_read" | "file_write" | "web_search" | "tool_install" | "agent_spawn" | "flow_start" | "flow_complete" | "approval_request" | "approval_granted" | "approval_denied";
  summary: string;
  details?: string;
  status: "success" | "error" | "pending" | "running";
  timestamp: number;
}

export interface ShellEntry {
  id: string;
  sessionId: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timestamp: number;
}

export interface AgentSession {
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

export interface IDEFile {
  path: string;
  content: string;
  language: string;
  lastModified: number;
}

// ─── In-Memory Store ──────────────────────────────────────────────────────────

const fileChanges = new Map<string, FileChange[]>();
const worklog = new Map<string, WorklogEntry[]>();
const shellHistory = new Map<string, ShellEntry[]>();
const agentSessions = new Map<string, AgentSession[]>();
const ideFiles = new Map<string, IDEFile[]>();

let idCounter = 0;
function nextId(): string {
  return `evt-${Date.now()}-${++idCounter}`;
}

// ─── File Changes ─────────────────────────────────────────────────────────────

export function trackFileChange(
  sessionId: string,
  path: string,
  operation: FileChange["operation"],
  content?: string,
  bytes?: number,
): void {
  if (!fileChanges.has(sessionId)) fileChanges.set(sessionId, []);
  fileChanges.get(sessionId)!.push({
    id: nextId(),
    sessionId,
    path,
    operation,
    content: content?.slice(0, 5000),
    bytes,
    timestamp: Date.now(),
  });
}

export function getFileChanges(sessionId?: string): FileChange[] {
  if (sessionId) return fileChanges.get(sessionId) ?? [];
  const all: FileChange[] = [];
  for (const entries of fileChanges.values()) all.push(...entries);
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Worklog ──────────────────────────────────────────────────────────────────

export function addWorklogEntry(
  sessionId: string,
  action: WorklogEntry["action"],
  summary: string,
  status: WorklogEntry["status"] = "success",
  details?: string,
): void {
  if (!worklog.has(sessionId)) worklog.set(sessionId, []);
  worklog.get(sessionId)!.push({
    id: nextId(),
    sessionId,
    action,
    summary,
    details,
    status,
    timestamp: Date.now(),
  });
}

export function getWorklog(sessionId?: string): WorklogEntry[] {
  if (sessionId) return worklog.get(sessionId) ?? [];
  const all: WorklogEntry[] = [];
  for (const entries of worklog.values()) all.push(...entries);
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Shell History ────────────────────────────────────────────────────────────

export function addShellEntry(
  sessionId: string,
  command: string,
  stdout: string,
  stderr: string,
  exitCode: number | null,
  durationMs: number,
): void {
  if (!shellHistory.has(sessionId)) shellHistory.set(sessionId, []);
  shellHistory.get(sessionId)!.push({
    id: nextId(),
    sessionId,
    command,
    stdout: stdout.slice(0, 10000),
    stderr: stderr.slice(0, 5000),
    exitCode,
    durationMs,
    timestamp: Date.now(),
  });
}

export function getShellHistory(sessionId?: string): ShellEntry[] {
  if (sessionId) return shellHistory.get(sessionId) ?? [];
  const all: ShellEntry[] = [];
  for (const entries of shellHistory.values()) all.push(...entries);
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Agent Sessions ───────────────────────────────────────────────────────────

export function spawnAgentSession(
  parentSessionId: string,
  agentRole: string,
  taskDescription: string,
): string {
  const id = nextId();
  if (!agentSessions.has(parentSessionId)) agentSessions.set(parentSessionId, []);
  agentSessions.get(parentSessionId)!.push({
    id,
    parentSessionId,
    agentRole,
    status: "running",
    taskDescription,
    startedAt: Date.now(),
    commandCount: 0,
  });
  return id;
}

export function updateAgentSession(
  parentSessionId: string,
  agentId: string,
  updates: Partial<Pick<AgentSession, "status" | "commandCount" | "lastActivity" | "completedAt">>,
): void {
  const sessions = agentSessions.get(parentSessionId);
  if (!sessions) return;
  const session = sessions.find((s) => s.id === agentId);
  if (session) Object.assign(session, updates);
}

export function getAgentSessions(parentSessionId?: string): AgentSession[] {
  if (parentSessionId) return agentSessions.get(parentSessionId) ?? [];
  const all: AgentSession[] = [];
  for (const entries of agentSessions.values()) all.push(...entries);
  return all.sort((a, b) => b.startedAt - a.startedAt);
}

// ─── IDE Files ────────────────────────────────────────────────────────────────

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rs: "rust", go: "go", rb: "ruby", java: "java",
    sh: "bash", bash: "bash", zsh: "bash", md: "markdown", json: "json",
    yaml: "yaml", yml: "yaml", toml: "toml", xml: "xml", html: "html",
    css: "css", sql: "sql", txt: "plaintext", conf: "ini", cfg: "ini",
  };
  return langMap[ext] ?? "plaintext";
}

export function trackIDEFile(sessionId: string, path: string, content: string): void {
  if (!ideFiles.has(sessionId)) ideFiles.set(sessionId, []);
  const files = ideFiles.get(sessionId)!;
  const existing = files.find((f) => f.path === path);
  if (existing) {
    existing.content = content.slice(0, 50000);
    existing.lastModified = Date.now();
  } else {
    files.push({
      path,
      content: content.slice(0, 50000),
      language: detectLanguage(path),
      lastModified: Date.now(),
    });
  }
}

export function getIDEFiles(sessionId?: string): IDEFile[] {
  if (sessionId) return ideFiles.get(sessionId) ?? [];
  const all: IDEFile[] = [];
  for (const entries of ideFiles.values()) all.push(...entries);
  return all.sort((a, b) => b.lastModified - a.lastModified);
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

export function getSessionStats(sessionId?: string): {
  totalCommands: number;
  totalFileChanges: number;
  totalWorklogEntries: number;
  totalAgents: number;
  totalFiles: number;
} {
  return {
    totalCommands: getShellHistory(sessionId).length,
    totalFileChanges: getFileChanges(sessionId).length,
    totalWorklogEntries: getWorklog(sessionId).length,
    totalAgents: getAgentSessions(sessionId).length,
    totalFiles: getIDEFiles(sessionId).length,
  };
}
