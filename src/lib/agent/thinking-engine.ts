import { PTGNode, Finding } from "./ptg";
import { FailedAttempt, AttackStrategy } from "./strategies";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { kgClient } from "../neo4j";
import { searchCVEs } from "../qdrant";
import { buildSearchEmbedding } from "../embeddings";

export interface Thought {
  step: number;
  type: "perception" | "reasoning" | "hypothesis" | "reflection" | "decision";
  content: string;
  evidence?: string;
  confidence: number;
}

export interface ThoughtBranch {
  id: string;
  description: string;
  expectedImpact: "critical" | "high" | "medium" | "low";
  probability: number; // 0-1 likelihood of success
  score: number;       // impact * probability
  reasoning: string;   // why this branch was considered
}

export interface ThoughtChain {
  id: string;
  depth: number;
  thoughts: Thought[];
  conclusion: string;
  confidence: number;
  alternativePaths: ThoughtBranch[];
  reflections: string[];
  timeMs: number;
}

export interface Hypothesis {
  id: string;
  assertion: string;
  verificationCommand: string;
  expectedOutput: string;
  confidence: number;
}

export interface Reflection {
  analysis: string;
  loopDetected: boolean;
  suggestedPivot: string;
  updatedConfidence: number;
}

export interface ReactResult {
  completed: boolean;
  thoughtChain: ThoughtChain;
  findings: Finding[];
  actionCommand?: string;
}

export class ThinkingEngine {
  private sessionId: string;
  private primaryModel: string;
  private fallbackModel: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.primaryModel = process.env.LLM_MODEL || "meta/llama-3.1-70b-instruct";
    this.fallbackModel = "meta-llama/llama-3.1-70b-instruct";
  }

  private getProvider() {
    const baseURL = process.env.LLM_BASE_URL || "https://integrate.api.nvidia.com/v1";
    const apiKey = process.env.LLM_API_KEY || "";
    
    return createOpenAI({
      baseURL,
      apiKey,
    });
  }

  /**
   * Helper to query LLM for text output.
   */
  private async queryLLM(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const provider = this.getProvider();
      const result = await generateText({
        model: provider(this.primaryModel),
        prompt,
        system: systemPrompt,
        maxTokens: 1024,
      } as any);
      return result.text;
    } catch (error) {
      console.warn("[ThinkingEngine] LLM primary failed, trying fallback:", error);
      try {
        const provider = createOpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: process.env.OPENROUTER_API_KEY || "",
        });
        const result = await generateText({
          model: provider(this.fallbackModel),
          prompt,
          system: systemPrompt,
          maxTokens: 1024,
        } as any);
        return result.text;
      } catch (fbError: any) {
        console.error("[ThinkingEngine] All LLM endpoints failed:", fbError);
        throw new Error(`LLM Failure: ${fbError.message}`);
      }
    }
  }

  /**
   * Tree-of-Thought (ToT) Planner: generates N attack branches, scores each, and picks the best.
   */
  async planWithToT(target: string, branches: number = 3): Promise<ThoughtBranch[]> {
    const systemPrompt = "You are the advanced planning layer of Ultron AI. Break down target attack surfaces using Tree-of-Thought branching.";
    const prompt = `Target: ${target}
Analyze the target attack surface and output exactly ${branches} different potential attack branches.
For each branch, provide:
1. ID (e.g., branch-1)
2. Description
3. Expected Impact (critical, high, medium, low)
4. Probability of success (0.0 to 1.0)
5. Score (Expected Impact converted to weight: critical=10, high=7, medium=4, low=2 multiplied by probability)
6. Reasoning

Format the response strictly as a JSON array of branches, e.g.:
[
  {
    "id": "branch-1",
    "description": "...",
    "expectedImpact": "high",
    "probability": 0.8,
    "score": 5.6,
    "reasoning": "..."
  }
]`;

    try {
      const response = await this.queryLLM(prompt, systemPrompt);
      const jsonStart = response.indexOf("[");
      const jsonEnd = response.lastIndexOf("]") + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = response.slice(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr) as ThoughtBranch[];
        return parsed.sort((a, b) => b.score - a.score);
      }
    } catch (err) {
      console.error("[ThinkingEngine] planWithToT JSON parse failed, returning fallback plan.", err);
    }

    // Default Fallback branches
    return [
      {
        id: "branch-recon",
        description: `Full port and service scan on ${target}`,
        expectedImpact: "medium",
        probability: 0.95,
        score: 3.8,
        reasoning: "Standard recon baseline to build initial mapping."
      },
      {
        id: "branch-web-enum",
        description: `Deep web vulnerability scanning on ${target}`,
        expectedImpact: "high",
        probability: 0.7,
        score: 4.9,
        reasoning: "Web applications present the largest initial access surface."
      }
    ];
  }

  /**
   * Hypothesis-Driven Testing: verifies potential vulnerabilities.
   */
  async hypothesize(observation: string, findings: Finding[]): Promise<Hypothesis[]> {
    const prompt = `Observation: ${observation}
Findings so far: ${JSON.stringify(findings)}

Based on these findings, formulate up to 2 logical hypotheses about vulnerabilities that might exist.
For each hypothesis:
1. Assertion (what vulnerability is suspected)
2. Verification command (a safe check command to run)
3. Expected output (what output confirms the assertion)
4. Confidence (0-100)

Format strictly as JSON:
[
  {
    "id": "hypo-1",
    "assertion": "...",
    "verificationCommand": "...",
    "expectedOutput": "...",
    "confidence": 75
  }
]`;

    try {
      const response = await this.queryLLM(prompt);
      const jsonStart = response.indexOf("[");
      const jsonEnd = response.lastIndexOf("]") + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        return JSON.parse(response.slice(jsonStart, jsonEnd)) as Hypothesis[];
      }
    } catch (e) {
      console.warn("[ThinkingEngine] hypothesize parse failed:", e);
    }

    return [];
  }

  /**
   * Self-Reflection: detects loop and suggests alternative pivot.
   */
  async reflect(history: ThoughtChain[], failures: FailedAttempt[]): Promise<Reflection> {
    const prompt = `History of operations: ${JSON.stringify(history)}
Recent failures: ${JSON.stringify(failures)}

Analyze if we are stuck in a loop or repeating the same errors.
Suggest a pivot strategy and update our operational confidence.

Format strictly as JSON:
{
  "analysis": "Why we are failing or stuck...",
  "loopDetected": true/false,
  "suggestedPivot": "What new approach or different tool we should use instead",
  "updatedConfidence": 55
}`;

    try {
      const response = await this.queryLLM(prompt);
      const jsonStart = response.indexOf("{");
      const jsonEnd = response.lastIndexOf("}") + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        return JSON.parse(response.slice(jsonStart, jsonEnd)) as Reflection;
      }
    } catch (e) {
      console.warn("[ThinkingEngine] reflect parse failed:", e);
    }

    return {
      analysis: "Unable to parse self-reflection analysis.",
      loopDetected: failures.length > 3,
      suggestedPivot: "Try basic recon or directory enumeration.",
      updatedConfidence: 50,
    };
  }

  /**
   * ReAct Loop execution cycle logic.
   */
  async reactLoop(task: PTGNode, maxIterations: number = 3): Promise<ReactResult> {
    const startTime = Date.now();
    
    const prompt = `Task details:
Title: ${task.title}
Phase: ${task.phase}
Risk Level: ${task.risk_level}
Retry Count: ${task.retry_count}

Think step-by-step to plan the immediate next command to run for this task.
Generate:
1. Thought: Analysis of the situation
2. Action: Shell command to run
3. Confidence: Score 0-100

Format strictly as JSON:
{
  "thought": "...",
  "action": "...",
  "confidence": 85
}`;

    try {
      const response = await this.queryLLM(prompt);
      const jsonStart = response.indexOf("{");
      const jsonEnd = response.lastIndexOf("}") + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(response.slice(jsonStart, jsonEnd));
        
        const thought: Thought = {
          step: 1,
          type: "reasoning",
          content: parsed.thought,
          confidence: parsed.confidence,
        };

        const chain: ThoughtChain = {
          id: `chain-${Date.now()}`,
          depth: 1,
          thoughts: [thought],
          conclusion: `Will execute action command: ${parsed.action}`,
          confidence: parsed.confidence,
          alternativePaths: [],
          reflections: [],
          timeMs: Date.now() - startTime,
        };

        return {
          completed: false,
          thoughtChain: chain,
          findings: [],
          actionCommand: parsed.action,
        };
      }
    } catch (e) {
      console.error("[ThinkingEngine] reactLoop failed:", e);
    }

    // Baseline fallback command
    return {
      completed: true,
      thoughtChain: {
        id: `chain-fallback-${Date.now()}`,
        depth: 0,
        thoughts: [],
        conclusion: "Execution failed to initialize.",
        confidence: 0,
        alternativePaths: [],
        reflections: [],
        timeMs: Date.now() - startTime,
      },
      findings: [],
    };
  }

  /**
   * Memory-Augmented Reasoning: recall similar contexts from past sessions.
   */
  async recallAndReason(query: string): Promise<ThoughtChain> {
    const startTime = Date.now();
    let memorySnippet = "";

    // A. Query Qdrant for similar CVEs / past exploits
    try {
      const embedding = await buildSearchEmbedding(query);
      const vectorResults = await searchCVEs(embedding, "cve_exploits", 3);
      if (vectorResults && vectorResults.length > 0) {
        memorySnippet += `[Qdrant Memory Matches]\n` + vectorResults.map((r: any) => `- ${r.payload?.cve_id}: ${r.payload?.description}`).join("\n");
      }
    } catch (err: any) {
      console.log(`[ThinkingEngine] Qdrant recall skipped: ${err.message}`);
    }

    // B. Query Neo4j for past attack relationships
    try {
      const session = kgClient.session();
      const result = await session.run(
        `MATCH (s:Service)-[r:VULNERABLE_TO]->(v:Vulnerability) WHERE s.name CONTAINS $query RETURN s.name as service, v.cve_id as cve LIMIT 3`,
        { query }
      );
      if (result.records.length > 0) {
        memorySnippet += `\n[Neo4j Knowledge Graph Matches]\n` + result.records.map(r => `- Service ${r.get("service")} vulnerable to ${r.get("cve")}`).join("\n");
      }
      await session.close();
    } catch (err: any) {
      console.log(`[ThinkingEngine] Neo4j recall skipped: ${err.message}`);
    }

    const prompt = `Context query: ${query}
Memory Context retrieved:
${memorySnippet || "No past patterns matched."}

Reason on the matches and summarize how this should guide the next attack phase.
Output:
1. Analysis thought
2. Recommended attack method
3. Confidence score (0-100)

Format strictly as JSON:
{
  "thought": "...",
  "method": "...",
  "confidence": 90
}`;

    const response = await this.queryLLM(prompt);
    const jsonStart = response.indexOf("{");
    const jsonEnd = response.lastIndexOf("}") + 1;
    let parsed: any = {};
    if (jsonStart !== -1 && jsonEnd !== -1) {
      try {
        parsed = JSON.parse(response.slice(jsonStart, jsonEnd));
      } catch (err) {
        parsed = { thought: "Error parsing LLM reasoning.", method: "none", confidence: 50 };
      }
    }

    return {
      id: `mem-chain-${Date.now()}`,
      depth: 1,
      thoughts: [
        {
          step: 1,
          type: "perception",
          content: parsed.thought || "Recalled past security contexts.",
          confidence: parsed.confidence || 70,
        }
      ],
      conclusion: parsed.method || "No specific method suggested.",
      confidence: parsed.confidence || 70,
      alternativePaths: [],
      reflections: [],
      timeMs: Date.now() - startTime,
    };
  }
}
