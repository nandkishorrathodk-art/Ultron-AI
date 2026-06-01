import { ThinkingEngine } from "../thinking-engine";

jest.mock("@ai-sdk/openai", () => ({
  createOpenAI: jest.fn().mockImplementation(() => {
    return jest.fn().mockImplementation(() => ({
      modelId: "mock-model",
    }));
  }),
}));

jest.mock("ai", () => ({
  generateText: jest.fn().mockResolvedValue({
    text: JSON.stringify([
      {
        id: "branch-1",
        description: "Test php web scan",
        expectedImpact: "high",
        probability: 0.8,
        score: 5.6,
        reasoning: "Php apps are often vulnerable."
      }
    ]),
  }),
}));

jest.mock("../../neo4j", () => ({
  kgClient: {
    session: () => ({
      run: jest.fn().mockResolvedValue({ records: [] }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock("../../qdrant", () => ({
  searchCVEs: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../embeddings", () => ({
  buildSearchEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]),
}));

describe("ThinkingEngine Core Modes", () => {
  let engine: ThinkingEngine;

  beforeEach(() => {
    engine = new ThinkingEngine("test-session");
  });

  it("should generate plan via planWithToT", async () => {
    const branches = await engine.planWithToT("testphp.vulnweb.com");
    expect(branches.length).toBeGreaterThan(0);
    expect(branches[0].id).toBe("branch-1");
  });

  it("should generate hypothesis via hypothesize", async () => {
    const ai = require("ai");
    ai.generateText.mockResolvedValueOnce({
      text: JSON.stringify([
        {
          id: "hypo-1",
          assertion: "SQL Injection exists on ID parameter",
          verificationCommand: "sqlmap -u 'http://target' --batch",
          expectedOutput: "sqlmap identified blind SQLi",
          confidence: 85
        }
      ]),
    });

    const hypos = await engine.hypothesize("Found URL with parameters", []);
    expect(hypos.length).toBe(1);
    expect(hypos[0].id).toBe("hypo-1");
  });
});
