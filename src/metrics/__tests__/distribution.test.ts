import { describe, it, expect, vi } from "vitest";
import {
  computeDistributionMetric,
  TokenNotFoundError,
} from "../distribution.js";
import type { MirrorClient } from "../../mirror/client.js";
import type { TokenInfo, TokenBalanceEntry } from "../../mirror/types.js";

function createMockClient(
  tokenInfo: TokenInfo | null,
  balances: TokenBalanceEntry[] = []
): MirrorClient {
  return {
    getToken: vi.fn().mockResolvedValue(tokenInfo),
    getTokenBalances: vi.fn().mockResolvedValue(balances),
    getAccount: vi.fn(),
    getAccountTransactions: vi.fn(),
    getAccountTokens: vi.fn(),
  } as unknown as MirrorClient;
}

function createTokenInfo(overrides: Partial<TokenInfo> = {}): TokenInfo {
  return {
    token_id: "0.0.1234",
    name: "Test Token",
    symbol: "TEST",
    decimals: "8",
    total_supply: "100000000000000",
    type: "FUNGIBLE_COMMON",
    treasury_account_id: "0.0.5678",
    created_timestamp: "1234567890.000000000",
    ...overrides,
  };
}

describe("computeDistributionMetric", () => {
  const testTokenId = "0.0.1234";

  it("throws TokenNotFoundError for non-existent token", async () => {
    const client = createMockClient(null);

    await expect(
      computeDistributionMetric(client, { tokenId: testTokenId })
    ).rejects.toThrow(TokenNotFoundError);
  });

  it("returns basic token info", async () => {
    const tokenInfo = createTokenInfo({
      name: "My Token",
      symbol: "MYT",
      decimals: "6",
    });
    const client = createMockClient(tokenInfo, []);

    const result = await computeDistributionMetric(client, {
      tokenId: testTokenId,
    });

    expect(result.tokenId).toBe(testTokenId);
    expect(result.tokenName).toBe("My Token");
    expect(result.tokenSymbol).toBe("MYT");
    expect(result.decimals).toBe(6);
  });

  it("returns zero metrics for token with no holders", async () => {
    const client = createMockClient(createTokenInfo(), []);

    const result = await computeDistributionMetric(client, {
      tokenId: testTokenId,
    });

    expect(result.totalHolders).toBe(0);
    expect(result.topHolders).toHaveLength(0);
    expect(result.giniCoefficient).toBe(0);
    expect(result.concentration.top1Percent).toBe(0);
  });

  it("calculates Gini coefficient of 0 for equal distribution", async () => {
    // 10 holders each with 100 tokens
    const balances: TokenBalanceEntry[] = Array.from({ length: 10 }, (_, i) => ({
      account: `0.0.${1000 + i}`,
      balance: 10000000000, // 100 tokens with 8 decimals
    }));

    const client = createMockClient(createTokenInfo(), balances);

    const result = await computeDistributionMetric(client, {
      tokenId: testTokenId,
    });

    expect(result.giniCoefficient).toBe(0);
  });

  it("calculates high Gini coefficient for concentrated distribution", async () => {
    // 1 whale with 99%, 99 others with 0.01% each
    const balances: TokenBalanceEntry[] = [
      { account: "0.0.1000", balance: 9900000000 }, // 99 tokens
      ...Array.from({ length: 99 }, (_, i) => ({
        account: `0.0.${1001 + i}`,
        balance: 1010101, // ~0.01 tokens each
      })),
    ];

    const client = createMockClient(createTokenInfo(), balances);

    const result = await computeDistributionMetric(client, {
      tokenId: testTokenId,
    });

    expect(result.giniCoefficient).toBeGreaterThan(0.9);
  });

  it("returns top 10 holders sorted by balance", async () => {
    const balances: TokenBalanceEntry[] = [
      { account: "0.0.1001", balance: 500000000 },
      { account: "0.0.1002", balance: 300000000 },
      { account: "0.0.1003", balance: 200000000 },
    ];

    const client = createMockClient(createTokenInfo(), balances);

    const result = await computeDistributionMetric(client, {
      tokenId: testTokenId,
    });

    expect(result.topHolders).toHaveLength(3);
    expect(result.topHolders[0].account).toBe("0.0.1001");
    expect(result.topHolders[0].balance).toBe(5); // 500000000 / 10^8
    expect(result.topHolders[0].percentage).toBe(50);
  });

  it("limits top holders to 10", async () => {
    const balances: TokenBalanceEntry[] = Array.from({ length: 20 }, (_, i) => ({
      account: `0.0.${1000 + i}`,
      balance: (20 - i) * 100000000,
    }));

    const client = createMockClient(createTokenInfo(), balances);

    const result = await computeDistributionMetric(client, {
      tokenId: testTokenId,
    });

    expect(result.topHolders).toHaveLength(10);
    expect(result.totalHolders).toBe(20);
  });

  it("calculates concentration percentages correctly", async () => {
    // 100 holders: first holds 50%, next 9 hold 4% each, rest hold 0.6% each
    const balances: TokenBalanceEntry[] = [
      { account: "0.0.1000", balance: 50000000 }, // 50%
      ...Array.from({ length: 9 }, (_, i) => ({
        account: `0.0.${1001 + i}`,
        balance: 4000000, // 4% each = 36% total
      })),
      ...Array.from({ length: 90 }, (_, i) => ({
        account: `0.0.${1010 + i}`,
        balance: 155556, // ~0.156% each ≈ 14%
      })),
    ];

    const client = createMockClient(
      createTokenInfo({ decimals: "6" }),
      balances
    );

    const result = await computeDistributionMetric(client, {
      tokenId: testTokenId,
    });

    // Top 1% = 1 holder = 50%
    expect(result.concentration.top1Percent).toBe(50);
    // Top 10% = 10 holders = 50 + 36 = 86%
    expect(result.concentration.top10Percent).toBe(86);
  });

  it("applies correct decimal scaling to balances", async () => {
    const balances: TokenBalanceEntry[] = [
      { account: "0.0.1000", balance: 123456789012 },
    ];

    // Test with 8 decimals
    const client8 = createMockClient(
      createTokenInfo({ decimals: "8" }),
      balances
    );
    const result8 = await computeDistributionMetric(client8, {
      tokenId: testTokenId,
    });
    expect(result8.topHolders[0].balance).toBe(1234.56789012);

    // Test with 0 decimals
    const client0 = createMockClient(
      createTokenInfo({ decimals: "0" }),
      balances
    );
    const result0 = await computeDistributionMetric(client0, {
      tokenId: testTokenId,
    });
    expect(result0.topHolders[0].balance).toBe(123456789012);
  });

  it("includes timestamp in result", async () => {
    const client = createMockClient(createTokenInfo(), []);

    const before = new Date().toISOString();
    const result = await computeDistributionMetric(client, {
      tokenId: testTokenId,
    });
    const after = new Date().toISOString();

    expect(result.timestamp >= before).toBe(true);
    expect(result.timestamp <= after).toBe(true);
  });
});
