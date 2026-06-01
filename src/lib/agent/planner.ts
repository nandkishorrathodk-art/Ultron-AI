import { PenetrationTaskGraph, PTGNode } from "./ptg";
import { buildStandardTemplate } from "./task-templates";
import { ThinkingEngine, ThoughtChain } from "./thinking-engine";

export interface PlannerInput {
  target: string;
  objective?: string;
  mode?: "standard" | "ctf" | "bug_bounty" | "continuous";
  maxSteps?: number;
  autoApproveRed?: boolean;
}

export interface PlannerOutput {
  sessionId: string;
  targetScope: string[];
  mode: string;
  plan: PTGNode[];
  thinkingChain: ThoughtChain;
  estimatedDuration: string;
  summary: string;
}

export class AutonomousPlanner {
  private sessionId: string;
  private thinkingEngine: ThinkingEngine;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.thinkingEngine = new ThinkingEngine(sessionId);
  }

  /**
   * Generates a stateful Penetration Task Graph (PTG) and thinking chain for a target.
   */
  async plan(input: PlannerInput): Promise<PlannerOutput> {
    const mode = input.mode || "standard";
    const target = input.target;

    console.log(`[AutonomousPlanner] Formulating plan for target: ${target} in mode: ${mode}`);

    // 1. Run Tree-of-Thought planning to analyze best branches
    const branches = await this.thinkingEngine.planWithToT(target, 3);
    const selectedBranch = branches[0];

    // 2. Generate detailed thinking chain for audit trace
    const thinkingChain: ThoughtChain = {
      id: `plan-chain-${Date.now()}`,
      depth: 2,
      thoughts: [
        {
          step: 1,
          type: "perception",
          content: `Analyzing attack surface scope for: ${target}`,
          confidence: 90
        },
        {
          step: 2,
          type: "reasoning",
          content: `Selected branch: "${selectedBranch.description}" as highest priority (score: ${selectedBranch.score})`,
          evidence: selectedBranch.reasoning,
          confidence: Math.round(selectedBranch.probability * 100)
        }
      ],
      conclusion: `Initiating ${mode} attack plan focused on ${selectedBranch.description}`,
      confidence: Math.round(selectedBranch.probability * 100),
      alternativePaths: branches.slice(1),
      reflections: [
        `Target: ${target} is estimated to require standard network and web application penetration test.`
      ],
      timeMs: 250
    };

    // 3. Build actual task nodes using predefined template builders
    // For now we default to the standard mode templates
    const planNodes = buildStandardTemplate(target);

    // Filter or adjust priorities of nodes based on Tot branch selected
    if (selectedBranch.id === "branch-web-enum") {
      // Elevate priority of web-relevant tasks
      for (const node of planNodes) {
        if (node.phase === "recon" && node.title.includes("Technology")) {
          node.priority = 1;
        }
      }
    }

    return {
      sessionId: this.sessionId,
      targetScope: [target],
      mode,
      plan: planNodes,
      thinkingChain,
      estimatedDuration: "25 minutes",
      summary: `Autonomous scanning suite pre-configured for ${target}. Primary attack vector: ${selectedBranch.description}.`
    };
  }
}
