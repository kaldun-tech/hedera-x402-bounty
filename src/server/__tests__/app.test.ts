import { describe, it, expect, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jsonBody(res: Response): Promise<any> {
  return res.json();
}

// Mock the config to avoid requiring env vars in tests
vi.mock("../../config.js", () => ({
  config: {
    port: 4021,
    hederaNetwork: "hedera:testnet",
    payToAccount: "0.0.12345",
    facilitatorUrl: "https://api.testnet.blocky402.com",
    mirrorNodeUrl: "https://testnet.mirrornode.hedera.com",
  },
}));

// Mock the x402 middleware to pass through without payment
vi.mock("../x402.js", () => ({
  createPaymentMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

// Import app after mocks are set up
import { app } from "../app.js";

// Mock the mirror client
vi.mock("../../mirror/client.js", () => ({
  MirrorClient: vi.fn().mockImplementation(() => ({
    getAccount: vi.fn().mockResolvedValue({
      account: "0.0.12345",
      balance: { balance: 5000000000, timestamp: "", tokens: [] },
      created_timestamp: "",
      deleted: false,
      memo: "",
      evm_address: null,
    }),
    getAccountTransactions: vi.fn().mockResolvedValue([]),
    getToken: vi.fn().mockResolvedValue({
      token_id: "0.0.456789",
      name: "Test Token",
      symbol: "TEST",
      decimals: "8",
      total_supply: "1000000000000",
      type: "FUNGIBLE_COMMON",
      treasury_account_id: "0.0.1234",
      created_timestamp: "1234567890.000000000",
    }),
    getTokenBalances: vi.fn().mockResolvedValue([
      { account: "0.0.1001", balance: 500000000000 },
      { account: "0.0.1002", balance: 300000000000 },
      { account: "0.0.1003", balance: 200000000000 },
    ]),
    getAccountTokens: vi.fn().mockResolvedValue([]),
  })),
  MirrorNodeError: class MirrorNodeError extends Error {
    constructor(message: string, public status: number) {
      super(message);
      this.name = "MirrorNodeError";
    }
  },
}));

describe("API Endpoints", () => {
  describe("GET /health", () => {
    it("returns ok status when mirror node is reachable", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.status).toBe("ok");
    });
  });

  describe("GET /catalog", () => {
    it("returns list of data products", async () => {
      const res = await app.request("/catalog");
      expect(res.status).toBe(200);
      const body = await jsonBody(res);

      expect(body.products).toBeDefined();
      expect(body.products["account-activity"]).toBeDefined();
      expect(body.products["token-distribution"]).toBeDefined();
      expect(body.products["portfolio-snapshot"]).toBeDefined();
      expect(body.payTo).toBe("0.0.12345");
      expect(body.network).toBe("hedera:testnet");
    });

    it("includes price information for each product", async () => {
      const res = await app.request("/catalog");
      const body = await jsonBody(res);

      expect(body.products["account-activity"].priceHbar).toBe(0.02);
      expect(body.products["token-distribution"].priceHbar).toBe(0.05);
      expect(body.products["portfolio-snapshot"].priceHbar).toBe(0.03);
    });
  });

  describe("GET /metrics/account/:id/activity", () => {
    it("returns 400 for invalid account ID format", async () => {
      const res = await app.request("/metrics/account/invalid/activity");
      expect(res.status).toBe(400);
      const body = await jsonBody(res);
      expect(body.error).toContain("Invalid account ID");
    });

    it("returns 400 for invalid days parameter", async () => {
      const res = await app.request("/metrics/account/0.0.12345/activity?days=abc");
      expect(res.status).toBe(400);
      const body = await jsonBody(res);
      expect(body.error).toContain("days must be between");
    });

    it("returns 400 for days out of range", async () => {
      const res = await app.request("/metrics/account/0.0.12345/activity?days=100");
      expect(res.status).toBe(400);
      const body = await jsonBody(res);
      expect(body.error).toContain("days must be between 1 and 90");
    });

    it("returns activity metrics for valid account", async () => {
      const res = await app.request("/metrics/account/0.0.12345/activity");
      expect(res.status).toBe(200);
      const body = await jsonBody(res);

      expect(body.product).toBe("account-activity");
      expect(body.price).toBe(0.02);
      expect(body.data).toBeDefined();
      expect(body.data.accountId).toBe("0.0.12345");
    });

    it("accepts valid days parameter", async () => {
      const res = await app.request("/metrics/account/0.0.12345/activity?days=7");
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data.periodDays).toBe(7);
    });
  });

  describe("GET /metrics/token/:id/distribution", () => {
    it("returns 400 for invalid token ID format", async () => {
      const res = await app.request("/metrics/token/invalid/distribution");
      expect(res.status).toBe(400);
      const body = await jsonBody(res);
      expect(body.error).toContain("Invalid token ID");
    });

    it("returns distribution metrics for valid token ID", async () => {
      const res = await app.request("/metrics/token/0.0.456789/distribution");
      expect(res.status).toBe(200);
      const body = await jsonBody(res);

      expect(body.product).toBe("token-distribution");
      expect(body.price).toBe(0.05);
      expect(body.data.tokenId).toBe("0.0.456789");
      expect(body.data.tokenName).toBe("Test Token");
      expect(body.data.tokenSymbol).toBe("TEST");
      expect(body.data.totalHolders).toBe(3);
      expect(body.data.topHolders).toHaveLength(3);
      expect(body.data.giniCoefficient).toBeDefined();
      expect(body.data.concentration).toBeDefined();
    });
  });

  describe("GET /metrics/account/:id/portfolio", () => {
    it("returns 400 for invalid account ID format", async () => {
      const res = await app.request("/metrics/account/invalid/portfolio");
      expect(res.status).toBe(400);
      const body = await jsonBody(res);
      expect(body.error).toContain("Invalid account ID");
    });

    it("returns portfolio snapshot for valid account ID", async () => {
      const res = await app.request("/metrics/account/0.0.12345/portfolio");
      expect(res.status).toBe(200);
      const body = await jsonBody(res);

      expect(body.product).toBe("portfolio-snapshot");
      expect(body.price).toBe(0.03);
      expect(body.data.accountId).toBe("0.0.12345");
      expect(body.data.hbarBalance).toBe(50); // 5000000000 tinybars = 50 HBAR
      expect(body.data.hbarBalanceTinybar).toBe(5000000000);
      expect(body.data.fungibleTokens).toBeDefined();
      expect(body.data.nftCollections).toBeDefined();
      expect(body.data.timestamp).toBeDefined();
    });
  });
});
