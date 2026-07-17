import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeActivityMetric } from "../activity.js";
import type { MirrorClient } from "../../mirror/client.js";
import type { Transaction } from "../../mirror/types.js";

// Mock MirrorClient
function createMockClient(
  transactions: Transaction[] = []
): MirrorClient {
  return {
    getAccountTransactions: vi.fn().mockResolvedValue(transactions),
    getAccount: vi.fn(),
    getToken: vi.fn(),
    getTokenBalances: vi.fn(),
    getAccountTokens: vi.fn(),
  } as unknown as MirrorClient;
}

// Helper to create test transactions
function createTransaction(
  overrides: Partial<Transaction> = {}
): Transaction {
  return {
    consensus_timestamp: "1234567890.000000000",
    transaction_id: "0.0.1234@1234567890.000000000",
    name: "CRYPTOTRANSFER",
    result: "SUCCESS",
    transfers: [],
    token_transfers: [],
    charged_tx_fee: 100000,
    valid_start_timestamp: "1234567890.000000000",
    node: "0.0.3",
    memo_base64: "",
    ...overrides,
  };
}

describe("computeActivityMetric", () => {
  const testAccountId = "0.0.12345";

  it("returns zero metrics for account with no transactions", async () => {
    const client = createMockClient([]);

    const result = await computeActivityMetric(client, {
      accountId: testAccountId,
    });

    expect(result.accountId).toBe(testAccountId);
    expect(result.transactionCount).toBe(0);
    expect(result.hbarIn).toBe(0);
    expect(result.hbarOut).toBe(0);
    expect(result.hbarNet).toBe(0);
    expect(result.uniqueCounterparties).toBe(0);
    expect(result.activityScore).toBe(0);
    expect(result.breakdown.successRate).toBe(0);
  });

  it("correctly calculates HBAR flows", async () => {
    const transactions = [
      createTransaction({
        transfers: [
          { account: testAccountId, amount: 500_000_000, is_approval: false }, // +5 HBAR in
          { account: "0.0.99999", amount: -500_000_000, is_approval: false },
        ],
      }),
      createTransaction({
        transfers: [
          { account: testAccountId, amount: -200_000_000, is_approval: false }, // -2 HBAR out
          { account: "0.0.88888", amount: 200_000_000, is_approval: false },
        ],
      }),
    ];

    const client = createMockClient(transactions);
    const result = await computeActivityMetric(client, {
      accountId: testAccountId,
    });

    expect(result.hbarIn).toBe(5);
    expect(result.hbarOut).toBe(2);
    expect(result.hbarNet).toBe(3);
  });

  it("counts unique counterparties correctly", async () => {
    const transactions = [
      createTransaction({
        transfers: [
          { account: testAccountId, amount: -100_000_000, is_approval: false },
          { account: "0.0.11111", amount: 100_000_000, is_approval: false },
        ],
      }),
      createTransaction({
        transfers: [
          { account: testAccountId, amount: -100_000_000, is_approval: false },
          { account: "0.0.11111", amount: 100_000_000, is_approval: false }, // Same counterparty
        ],
      }),
      createTransaction({
        transfers: [
          { account: testAccountId, amount: -100_000_000, is_approval: false },
          { account: "0.0.22222", amount: 100_000_000, is_approval: false }, // New counterparty
        ],
      }),
    ];

    const client = createMockClient(transactions);
    const result = await computeActivityMetric(client, {
      accountId: testAccountId,
    });

    expect(result.uniqueCounterparties).toBe(2);
  });

  it("counts transactions by type", async () => {
    const transactions = [
      createTransaction({ name: "CRYPTOTRANSFER" }),
      createTransaction({ name: "CRYPTOTRANSFER" }),
      createTransaction({ name: "CONTRACTCALL" }),
      createTransaction({ name: "TOKENMINT" }),
    ];

    const client = createMockClient(transactions);
    const result = await computeActivityMetric(client, {
      accountId: testAccountId,
    });

    expect(result.transactionCount).toBe(4);
    expect(result.breakdown.byType).toEqual({
      CRYPTOTRANSFER: 2,
      CONTRACTCALL: 1,
      TOKENMINT: 1,
    });
  });

  it("calculates success rate correctly", async () => {
    const transactions = [
      createTransaction({ result: "SUCCESS" }),
      createTransaction({ result: "SUCCESS" }),
      createTransaction({ result: "SUCCESS" }),
      createTransaction({ result: "INVALID_SIGNATURE" }),
    ];

    const client = createMockClient(transactions);
    const result = await computeActivityMetric(client, {
      accountId: testAccountId,
    });

    expect(result.breakdown.successRate).toBe(0.75);
  });

  it("respects days parameter with max limit", async () => {
    const client = createMockClient([]);

    // Test default (30 days)
    const result1 = await computeActivityMetric(client, {
      accountId: testAccountId,
    });
    expect(result1.periodDays).toBe(30);

    // Test custom value
    const result2 = await computeActivityMetric(client, {
      accountId: testAccountId,
      days: 7,
    });
    expect(result2.periodDays).toBe(7);

    // Test max limit (90 days)
    const result3 = await computeActivityMetric(client, {
      accountId: testAccountId,
      days: 365,
    });
    expect(result3.periodDays).toBe(90);
  });

  it("includes period timestamps in result", async () => {
    const client = createMockClient([]);

    const result = await computeActivityMetric(client, {
      accountId: testAccountId,
      days: 7,
    });

    expect(result.periodStart).toBeDefined();
    expect(result.periodEnd).toBeDefined();

    const start = new Date(result.periodStart);
    const end = new Date(result.periodEnd);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    expect(diffDays).toBeCloseTo(7, 0);
  });

  it("calculates activity score > 0 for active accounts", async () => {
    const transactions = Array.from({ length: 50 }, (_, i) =>
      createTransaction({
        transaction_id: `0.0.1234@${i}.000000000`,
        transfers: [
          { account: testAccountId, amount: -10_000_000, is_approval: false },
          { account: `0.0.${10000 + i}`, amount: 10_000_000, is_approval: false },
        ],
      })
    );

    const client = createMockClient(transactions);
    const result = await computeActivityMetric(client, {
      accountId: testAccountId,
      days: 30,
    });

    expect(result.activityScore).toBeGreaterThan(0);
    expect(result.activityScore).toBeLessThanOrEqual(100);
  });

  it("includes token transfers in counterparty count", async () => {
    const transactions = [
      createTransaction({
        transfers: [],
        token_transfers: [
          { account: testAccountId, amount: -100, token_id: "0.0.1001", is_approval: false },
          { account: "0.0.55555", amount: 100, token_id: "0.0.1001", is_approval: false },
        ],
      }),
    ];

    const client = createMockClient(transactions);
    const result = await computeActivityMetric(client, {
      accountId: testAccountId,
    });

    expect(result.uniqueCounterparties).toBe(1);
  });
});
