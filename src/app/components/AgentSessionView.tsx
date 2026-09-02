"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Play,
  Pause,
  StopCircle,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Terminal,
  Download,
} from "lucide-react";

interface Thought {
  step: number;
  type: string;
  content: string;
  confidence: number;
}

interface PTGNode {
  task_id: string;
  phase: string;
  title: string;
  status: string;
  priority: number;
  retry_count: number;
}

interface Finding {
  description: string;
  severity: string;
  cvss_score: number;
  validated?: boolean;
}

interface AgentSessionViewProps {
  sessionId: string;
  target: string;
  mode?: string;
  onStop?: () => void;
}

export default function AgentSessionView({
  sessionId,
  target,
  mode = "standard",
  onStop,
}: AgentSessionViewProps) {
  const [status, setStatus] = useState<string>("active");
  const [progress, setProgress] = useState<number>(0);
  const [activeTask, setActiveTask] = useState<string>("Initializing...");
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [tasks, setTasks] = useState<PTGNode[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Poll Redis API for live updates
  useEffect(() => {
    let intervalId: any;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/autonomous?sessionId=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.status) setStatus(data.status);
          if (data.plan) setTasks(data.plan);
          
          // Synthesize progress metric
          if (data.plan && data.plan.length > 0) {
            const completed = data.plan.filter((t: any) => t.status === "success" || t.status === "failed" || t.status === "skipped").length;
            setProgress(Math.round((completed / data.plan.length) * 100));
            
            const active = data.plan.find((t: any) => t.status === "running");
            if (active) setActiveTask(active.title);
          }
        }
      } catch (err) {
        console.error("Failed to poll session status:", err);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 4000);

    return () => clearInterval(intervalId);
  }, [sessionId]);

  // Handle mock streaming thoughts for visual engagement
  useEffect(() => {
    if (status !== "active") return;

    const interval = setInterval(() => {
      const mockThoughts: Thought[] = [
        {
          step: thoughts.length + 1,
          type: "reasoning",
          content: `Analyzing service version info and mapping vulnerability databases for ${target}`,
          confidence: 85,
        },
        {
          step: thoughts.length + 2,
          type: "hypothesis",
          content: "Vulnerable web endpoints exposed on port 80/443. Starting directory fuzzing check.",
          confidence: 90,
        },
        {
          step: thoughts.length + 3,
          type: "reflection",
          content: "Nmap port scan finished. Exposing services: Apache, MySQL. Moving to enumeration phase.",
          confidence: 95,
        },
      ];

      setThoughts((prev) => [...prev, mockThoughts[prev.length % mockThoughts.length]]);
    }, 8000);

    return () => clearInterval(interval);
  }, [status, thoughts.length, target]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thoughts]);

  const handleStop = async () => {
    try {
      await fetch(`/api/autonomous?sessionId=${sessionId}`, { method: "DELETE" });
      setStatus("failed");
      if (onStop) onStop();
    } catch (err) {
      console.error("Failed to stop session:", err);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl font-sans text-zinc-100 my-4">
      {/* Header section */}
      <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-red-500 animate-pulse" />
          <div>
            <h2 className="text-lg font-semibold tracking-wide">Ultron AI — Autonomous Pentest Module</h2>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">Session: {sessionId}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span>Target: {target}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span>Mode: {mode.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
        {/* Left Column: Progress & Graph */}
        <div className="p-6 col-span-2 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-zinc-400">Total Scan Progress</span>
              <span className="text-zinc-100 font-mono">{progress}%</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
              <div
                className="bg-gradient-to-r from-red-600 to-amber-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-red-500" />
              Attack Execution Graph
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm font-mono border border-dashed border-zinc-800 rounded-lg">
                  Generating initial attack graph...
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.task_id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      task.status === "running"
                        ? "bg-red-950/20 border-red-800/40 text-red-100"
                        : task.status === "success"
                          ? "bg-zinc-900/50 border-zinc-800/80 text-zinc-300"
                          : "bg-zinc-900/10 border-zinc-900 text-zinc-500"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {task.status === "success" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : task.status === "failed" ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : (
                        <div
                          className={`h-3 w-3 rounded-full ${
                            task.status === "running" ? "bg-red-500 animate-ping" : "bg-zinc-700"
                          }`}
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs font-mono uppercase text-zinc-500 mt-0.5">{task.phase}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-zinc-400 capitalize">{task.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Thinking Log */}
        <div className="p-6 flex flex-col h-full space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2 shrink-0">
            <Brain className="h-4 w-4 text-red-500" />
            Live Reasoning Trace
          </h3>

          <div className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg p-4 font-mono text-xs overflow-y-auto max-h-96 space-y-4 shadow-inner">
            {thoughts.length === 0 ? (
              <div className="text-zinc-600 italic">Thinking engine mapping targets...</div>
            ) : (
              thoughts.map((thought, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase">
                    <span>
                      Step {thought.step} • {thought.type}
                    </span>
                    <span>Conf: {thought.confidence}%</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed font-sans">{thought.content}</p>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>

          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between shrink-0">
            <div className="flex gap-2">
              {status === "active" ? (
                <Button variant="outline" size="sm" className="h-9 gap-1.5 font-medium border-zinc-800 hover:bg-zinc-900" onClick={handleStop}>
                  <Pause className="h-4 w-4" />
                  Pause Scan
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="h-9 gap-1.5 font-medium border-zinc-800 hover:bg-zinc-900" onClick={() => setStatus("active")}>
                  <Play className="h-4 w-4 text-emerald-500" />
                  Resume
                </Button>
              )}
              <Button variant="destructive" size="sm" className="h-9 gap-1.5 font-medium bg-red-950/40 hover:bg-red-950/80 border border-red-800/40 text-red-200" onClick={handleStop}>
                <StopCircle className="h-4 w-4" />
                Stop
              </Button>
            </div>

            <Button variant="outline" size="sm" className="h-9 gap-1.5 font-medium border-zinc-800 hover:bg-zinc-900" disabled={progress < 100}>
              <Download className="h-4 w-4" />
              Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
