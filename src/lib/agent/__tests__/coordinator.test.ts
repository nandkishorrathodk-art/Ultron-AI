import { PentestCoordinator } from "../coordinator";
import { getOrCreateSandbox } from "../../sandbox-manager";
import { buildTemplate } from "../task-templates";

// Mock sandbox manager
jest.mock("../../sandbox-manager", () => {
  const mockSandbox = {
    commands: {
      run: jest.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "mocked terminal command stdout",
        stderr: ""
      })
    },
    files: {
      write: jest.fn().mockResolvedValue(undefined)
    }
  };
  return {
    getOrCreateSandbox: jest.fn().mockResolvedValue(mockSandbox)
  };
});

// Mock task-templates
jest.mock("../task-templates", () => {
  return {
    buildTemplate: jest.fn().mockReturnValue([
      {
        task_id: "task_1",
        parent_ids: [],
        child_ids: [],
        phase: "recon",
        title: "Test Task",
        status: "pending",
        risk_level: "green",
        priority: 1,
        commands: ["browser_attack --type xss --url https://test.target"],
        findings: [],
        created_at: Date.now()
      }
    ]),
    spawnTasksFromFinding: jest.fn().mockReturnValue([])
  };
});

// Mock modules
jest.mock("../modules/reasoning", () => {
  return {
    decideNextTask: jest.fn()
      .mockResolvedValueOnce({
        task: {
          task_id: "task_1",
          title: "Test Task",
          phase: "recon",
          commands: ["browser_attack --type xss --url https://test.target"]
        },
        strategy: { description: "Standard attack" }
      })
      .mockResolvedValueOnce(null), // Terminate loop after 1 task
    analyzeFailure: jest.fn()
  };
});

jest.mock("../modules/intelligence", () => {
  return {
    gatherIntelligence: jest.fn().mockResolvedValue({})
  };
});

jest.mock("../modules/generation", () => {
  return {
    generateCommand: jest.fn().mockResolvedValue({
      command: "browser_attack --type xss --url https://test.target",
      riskLevel: "green"
    })
  };
});

jest.mock("../modules/parsing", () => {
  return {
    parseOutput: jest.fn().mockResolvedValue({
      findings: [
        {
          type: "vulnerability",
          severity: "high",
          description: "Reflected XSS",
          raw_output: "",
          cve_ids: [],
          cvss_score: 7.2,
          epss_score: 0.01,
          remediation: "Escape",
          evidence: ""
        }
      ],
      raw_output: "",
      tool_detected: "browser_attack",
      summary: "Found XSS"
    })
  };
});

jest.mock("../modules/validator", () => {
  return {
    validateFindings: jest.fn().mockImplementation((sandbox, findings) => {
      return Promise.resolve({
        validated: findings.map((f: any) => ({ finding: f })),
        unvalidated: []
      });
    })
  };
});

jest.mock("../modules/chainer", () => {
  return {
    detectChains: jest.fn().mockReturnValue([])
  };
});

jest.mock("../modules/memory", () => {
  return {
    storeMemory: jest.fn().mockResolvedValue(undefined)
  };
});

// Mock browser attack agent module to avoid running playwright code in standard mock
jest.mock("../modules/browser-attack", () => {
  return {
    BrowserAttackAgent: jest.fn().mockImplementation(() => {
      return {
        runScanner: jest.fn().mockResolvedValue({
          success: true,
          findings: [
            {
              type: "vulnerability",
              severity: "high",
              description: "Reflected XSS",
              raw_output: "Alert fired",
              cve_ids: [],
              cvss_score: 7.2,
              epss_score: 0.01,
              remediation: "Escape",
              evidence: "dialog message: 1",
              endpoint: "https://test.target",
              validated: true
            }
          ]
        })
      };
    })
  };
});

describe("PentestCoordinator", () => {
  it("should initialize PTG, run browser attack tasks, intercept browser_attack commands, and validate findings", async () => {
    const coordinator = new PentestCoordinator({
      sessionId: "session-1",
      targetScope: ["test.target"],
      mode: "standard",
      maxIterations: 2
    });

    const ptg = await coordinator.run();

    expect(buildTemplate).toHaveBeenCalledWith("test.target", "standard");
    expect(getOrCreateSandbox).toHaveBeenCalledWith("session-1");
    
    // Check that findings are committed to PTG
    const findings = ptg.getAllFindings();
    expect(findings.length).toBe(1);
    expect(findings[0].description).toBe("Reflected XSS");
  });
});
