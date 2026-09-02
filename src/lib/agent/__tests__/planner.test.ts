import { AutonomousPlanner } from "../planner";

jest.mock("../thinking-engine", () => {
  return {
    ThinkingEngine: jest.fn().mockImplementation(() => {
      return {
        planWithToT: jest.fn().mockResolvedValue([
          {
            id: "branch-web-enum",
            description: "Deep web scanning",
            expectedImpact: "high",
            probability: 0.8,
            score: 5.6,
            reasoning: "Tested"
          }
        ]),
      };
    }),
  };
});

describe("AutonomousPlanner", () => {
  let planner: AutonomousPlanner;

  beforeEach(() => {
    planner = new AutonomousPlanner("test-session");
  });

  it("should build standard attack plan successfully", async () => {
    const output = await planner.plan({
      target: "testphp.vulnweb.com",
      mode: "standard"
    });

    expect(output.sessionId).toBe("test-session");
    expect(output.plan.length).toBeGreaterThan(0);
    expect(output.thinkingChain.thoughts.length).toBe(2);
  });
});
