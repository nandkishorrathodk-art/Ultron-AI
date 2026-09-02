import { AutonomousRunner } from "../autonomous-runner";
import { PenetrationTaskGraph } from "../ptg";

jest.mock("@qdrant/js-client-rest", () => {
  return {
    QdrantClient: jest.fn(),
  };
});

jest.mock("../thinking-engine", () => {
  return {
    ThinkingEngine: jest.fn().mockImplementation(() => {
      return {
        planWithToT: jest.fn().mockResolvedValue([]),
        hypothesize: jest.fn().mockResolvedValue([]),
        reflect: jest.fn().mockResolvedValue({}),
      };
    }),
  };
});

jest.mock("../coordinator", () => {
  return {
    PentestCoordinator: jest.fn().mockImplementation(() => {
      return {
        run: jest.fn().mockResolvedValue(new PenetrationTaskGraph()),
      };
    }),
  };
});

describe("AutonomousRunner", () => {
  let runner: AutonomousRunner;

  beforeEach(() => {
    runner = new AutonomousRunner({
      sessionId: "test-runner-session",
      target: "testphp.vulnweb.com"
    });
  });

  it("should run autonomous session and return report", async () => {
    const report = await runner.run();
    expect(report).toContain("Ultron AI - Executive Penetration Testing Report");
  });
});
