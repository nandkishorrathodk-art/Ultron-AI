import {
  isLegacyDesktopAgentClient,
  isUltronAIDesktopUserAgent,
  shouldUseAgentLongForAgent,
} from "../agent-routing";

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15 Ultron-AI-Desktop/1.0";

describe("agent routing", () => {
  test("detects the Ultron-AI desktop user agent token", () => {
    expect(isUltronAIDesktopUserAgent(DESKTOP_UA)).toBe(true);
    expect(isUltronAIDesktopUserAgent("Mozilla/5.0 Safari/605.1.15")).toBe(
      false,
    );
  });

  test("routes desktop agent mode with the Ultron-AI user agent through agent-long", () => {
    expect(
      shouldUseAgentLongForAgent({
        mode: "agent",
        subscription: "pro",
        isTauri: true,
        userAgent: DESKTOP_UA,
      }),
    ).toBe(true);
  });

  test("routes web and current desktop free-user agent mode through Trigger.dev", () => {
    expect(
      shouldUseAgentLongForAgent({
        mode: "agent",
        subscription: "pro",
        isTauri: false,
      }),
    ).toBe(true);

    expect(
      shouldUseAgentLongForAgent({
        mode: "agent",
        subscription: "free",
        isTauri: true,
        userAgent: DESKTOP_UA,
      }),
    ).toBe(true);
  });

  test("does not route non-agent modes through agent-long", () => {
    expect(
      shouldUseAgentLongForAgent({
        mode: "ask",
        subscription: "pro",
        isTauri: true,
        userAgent: DESKTOP_UA,
      }),
    ).toBe(false);
  });

  test("blocks legacy desktop user agents from agent mode until they update", () => {
    const legacyUserAgent = "Mozilla/5.0 Safari/605.1.15";
    expect(
      isLegacyDesktopAgentClient({
        mode: "agent",
        isTauri: true,
        userAgent: legacyUserAgent,
      }),
    ).toBe(true);
    expect(
      shouldUseAgentLongForAgent({
        mode: "agent",
        subscription: "pro",
        isTauri: true,
        userAgent: legacyUserAgent,
      }),
    ).toBe(false);
  });
});
