/**
 * ULTRON v3.0 — Reasoning Module
 * Decides which task to execute next based on the flow state.
 */

import { FlowEngine, type FlowTask } from "../flow";

export function decideNextTask(engine: FlowEngine): FlowTask | null {
  const executable = engine.getExecutableTasks();
  return executable[0] ?? null;
}
