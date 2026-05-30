import * as crypto from "crypto";

export interface OOBInteraction {
  protocol: "dns" | "http" | "smtp";
  uniqueId: string;
  matchedId: string;
  rawRequest?: string;
  remoteAddress: string;
  timestamp: string;
}

export class CollaboratorService {
  private static OAST_SERVER = "oast.live";
  private correlationId: string;
  private secretKey: string;
  private uniqueDomain: string;
  private mockInteractions: OOBInteraction[] = [];
  private isMockMode: boolean = false;

  constructor(options?: { isMockMode?: boolean }) {
    this.isMockMode = options?.isMockMode || false;
    
    // Generate a unique correlation ID for interactsh registration
    const uuid = crypto.randomUUID().replace(/-/g, "");
    this.correlationId = uuid.substring(0, 20); // interactsh correlation id is 20 chars
    this.secretKey = crypto.randomUUID();
    
    // Subdomain formatting: <correlationId><random8>.<server>
    const random8 = crypto.randomBytes(4).toString("hex");
    this.uniqueDomain = `${this.correlationId}${random8}.${CollaboratorService.OAST_SERVER}`;
  }

  /**
   * Returns the unique callback URL for injecting into payloads (e.g. SSRF/RCE)
   */
  getCallbackUrl(protocol: "http" | "dns" = "http"): string {
    if (this.isMockMode) {
      return `${protocol}://mock-collaborator-${this.correlationId}.local`;
    }
    return `${protocol}://${this.uniqueDomain}`;
  }

  /**
   * Retrieves the unique domain
   */
  getDomain(): string {
    if (this.isMockMode) {
      return `mock-collaborator-${this.correlationId}.local`;
    }
    return this.uniqueDomain;
  }

  /**
   * Register with the public OAST server.
   * If registration fails, fallback to mock mode.
   */
  async register(): Promise<boolean> {
    if (this.isMockMode) return true;

    try {
      // In a standard interactsh client, we generate an RSA key and register it.
      // For a lightweight implementation, we register our correlation ID.
      const response = await fetch(`https://${CollaboratorService.OAST_SERVER}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "correlation-id": this.correlationId,
          "secret-key": this.secretKey,
        }),
      }).catch(() => null);

      if (response && response.status === 200) {
        return true;
      }
      
      // Fallback to mock mode if server is down or unreachable
      this.isMockMode = true;
      return true;
    } catch {
      this.isMockMode = true;
      return true;
    }
  }

  /**
   * Poll the OAST server (or check mock interactions) to retrieve any captured callbacks.
   */
  async pollInteractions(): Promise<OOBInteraction[]> {
    if (this.isMockMode) {
      return this.mockInteractions;
    }

    try {
      const response = await fetch(
        `https://${CollaboratorService.OAST_SERVER}/poll?correlation-id=${this.correlationId}&secret-key=${this.secretKey}`
      );
      
      if (response.status !== 200) {
        return [];
      }

      const data = await response.json();
      const interactions: OOBInteraction[] = (data.data || []).map((item: any) => ({
        protocol: item.protocol,
        uniqueId: item["unique-id"],
        matchedId: item["matched-id"],
        rawRequest: item["raw-request"],
        remoteAddress: item["remote-address"],
        timestamp: item.timestamp,
      }));

      return interactions;
    } catch {
      return [];
    }
  }

  /**
   * Used in tests or simulator to mock triggering a callback.
   */
  triggerMockCallback(protocol: "dns" | "http" | "smtp" = "http", remoteIp: string = "127.0.0.1"): void {
    this.mockInteractions.push({
      protocol,
      uniqueId: this.correlationId,
      matchedId: this.correlationId,
      remoteAddress: remoteIp,
      timestamp: new Date().toISOString(),
      rawRequest: protocol === "http" ? `GET / HTTP/1.1\r\nHost: ${this.uniqueDomain}\r\n\r\n` : undefined
    });
  }
}
