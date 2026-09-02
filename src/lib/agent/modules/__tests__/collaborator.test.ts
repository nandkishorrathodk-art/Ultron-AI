import { CollaboratorService } from "../collaborator";

describe("CollaboratorService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
  });

  it("should generate a unique correlation ID and domain", () => {
    const service = new CollaboratorService();
    const domain = service.getDomain();
    const url = service.getCallbackUrl("http");

    expect(domain).toContain("oast.live");
    expect(url).toContain("http://");
    expect(url).toContain("oast.live");
  });

  it("should support mock mode for local offline usage", async () => {
    const service = new CollaboratorService({ isMockMode: true });
    
    expect(service.getDomain()).toContain("mock-collaborator");
    expect(service.getCallbackUrl("http")).toContain("mock-collaborator");

    const registered = await service.register();
    expect(registered).toBe(true);

    const interactionsBefore = await service.pollInteractions();
    expect(interactionsBefore).toEqual([]);

    service.triggerMockCallback("http", "10.0.0.5");
    const interactionsAfter = await service.pollInteractions();
    expect(interactionsAfter.length).toBe(1);
    expect(interactionsAfter[0].protocol).toBe("http");
    expect(interactionsAfter[0].remoteAddress).toBe("10.0.0.5");
  });

  it("should handle successful registration with remote OAST server", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    const service = new CollaboratorService();
    const registered = await service.register();

    expect(registered).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://oast.live/register",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("correlation-id")
      })
    );
  });

  it("should fallback to mock mode if registration fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network connection lost"));

    const service = new CollaboratorService();
    const registered = await service.register();

    expect(registered).toBe(true); // gracefully falls back
    expect(service.getCallbackUrl("http")).toContain("mock-collaborator");
  });

  it("should fetch interactions via poll endpoint and map them", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              protocol: "dns",
              "unique-id": "corr123",
              "matched-id": "corr123",
              "remote-address": "8.8.8.8",
              timestamp: "2026-05-30T12:00:00Z"
            }
          ]
        })
    });

    const service = new CollaboratorService();
    const interactions = await service.pollInteractions();

    expect(interactions.length).toBe(1);
    expect(interactions[0].protocol).toBe("dns");
    expect(interactions[0].remoteAddress).toBe("8.8.8.8");
  });
});
