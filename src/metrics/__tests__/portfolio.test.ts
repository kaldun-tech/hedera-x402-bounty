import { describe, it, expect, vi } from "vitest";
import {
  computePortfolioMetric,
  AccountNotFoundError,
} from "../portfolio.js";
import type { MirrorClient } from "../../mirror/client.js";
import type {
  AccountInfo,
  AccountTokenBalance,
  TokenInfo,
} from "../../mirror/types.js";

function createMockClient(
  accountInfo: AccountInfo | null,
  tokenBalances: AccountTokenBalance[] = [],
  tokenInfoMap: Map<string, TokenInfo> = new Map()
): MirrorClient {
  return {
    getAccount: vi.fn().mockResolvedValue(accountInfo),
    getAccountTokens: vi.fn().mockResolvedValue(tokenBalances),
    getToken: vi.fn().mockImplementation((tokenId: string) => {
      return Promise.resolve(tokenInfoMap.get(tokenId) ?? null);
    }),
    getAccountTransactions: vi.fn(),
    getTokenBalances: vi.fn(),
  } as unknown as MirrorClient;
}

function createAccountInfo(
  overrides: Partial<AccountInfo> = {}
): AccountInfo {
  return {
    account: "0.0.12345",
    balance: {
      balance: 1000000000, // 10 HBAR
      timestamp: "1234567890.000000000",
      tokens: [],
    },
    created_timestamp: "1234567890.000000000",
    deleted: false,
    memo: "",
    evm_address: null,
    ...overrides,
  };
}

function createTokenInfo(
  tokenId: string,
  overrides: Partial<TokenInfo> = {}
): TokenInfo {
  return {
    token_id: tokenId,
    name: "Test Token",
    symbol: "TEST",
    decimals: "8",
    total_supply: "1000000000000",
    type: "FUNGIBLE_COMMON",
    treasury_account_id: "0.0.1234",
    created_timestamp: "1234567890.000000000",
    ...overrides,
  };
}

describe("computePortfolioMetric", () => {
  const testAccountId = "0.0.12345";

  it("throws AccountNotFoundError for non-existent account", async () => {
    const client = createMockClient(null);

    await expect(
      computePortfolioMetric(client, { accountId: testAccountId })
    ).rejects.toThrow(AccountNotFoundError);
  });

  it("returns HBAR balance correctly", async () => {
    const accountInfo = createAccountInfo({
      balance: {
        balance: 5000000000, // 50 HBAR
        timestamp: "1234567890.000000000",
        tokens: [],
      },
    });
    const client = createMockClient(accountInfo);

    const result = await computePortfolioMetric(client, {
      accountId: testAccountId,
    });

    expect(result.accountId).toBe(testAccountId);
    expect(result.hbarBalance).toBe(50);
    expect(result.hbarBalanceTinybar).toBe(5000000000);
  });

  it("returns empty arrays for account with no tokens", async () => {
    const client = createMockClient(createAccountInfo(), []);

    const result = await computePortfolioMetric(client, {
      accountId: testAccountId,
    });

    expect(result.tokenCount).toBe(0);
    expect(result.fungibleTokens).toHaveLength(0);
    expect(result.nftCollections).toHaveLength(0);
  });

  it("separates fungible tokens and NFTs", async () => {
    const tokenBalances: AccountTokenBalance[] = [
      { token_id: "0.0.1001", balance: 100000000, created_timestamp: "" },
      { token_id: "0.0.1002", balance: 5, created_timestamp: "" },
    ];

    const tokenInfoMap = new Map<string, TokenInfo>([
      ["0.0.1001", createTokenInfo("0.0.1001", { type: "FUNGIBLE_COMMON" })],
      [
        "0.0.1002",
        createTokenInfo("0.0.1002", {
          type: "NON_FUNGIBLE_UNIQUE",
          decimals: "0",
        }),
      ],
    ]);

    const client = createMockClient(
      createAccountInfo(),
      tokenBalances,
      tokenInfoMap
    );

    const result = await computePortfolioMetric(client, {
      accountId: testAccountId,
    });

    expect(result.fungibleTokens).toHaveLength(1);
    expect(result.fungibleTokens[0].tokenId).toBe("0.0.1001");
    expect(result.fungibleTokens[0].type).toBe("FUNGIBLE_COMMON");

    expect(result.nftCollections).toHaveLength(1);
    expect(result.nftCollections[0].tokenId).toBe("0.0.1002");
    expect(result.nftCollections[0].type).toBe("NON_FUNGIBLE_UNIQUE");
    expect(result.nftCollections[0].balance).toBe(5); // NFT count
  });

  it("applies correct decimal scaling", async () => {
    const tokenBalances: AccountTokenBalance[] = [
      { token_id: "0.0.1001", balance: 123456789012, created_timestamp: "" },
    ];

    const tokenInfoMap = new Map<string, TokenInfo>([
      ["0.0.1001", createTokenInfo("0.0.1001", { decimals: "8" })],
    ]);

    const client = createMockClient(
      createAccountInfo(),
      tokenBalances,
      tokenInfoMap
    );

    const result = await computePortfolioMetric(client, {
      accountId: testAccountId,
    });

    expect(result.fungibleTokens[0].balance).toBe(1234.56789012);
    expect(result.fungibleTokens[0].rawBalance).toBe(123456789012);
  });

  it("sorts tokens by balance descending", async () => {
    const tokenBalances: AccountTokenBalance[] = [
      { token_id: "0.0.1001", balance: 100, created_timestamp: "" },
      { token_id: "0.0.1002", balance: 500, created_timestamp: "" },
      { token_id: "0.0.1003", balance: 200, created_timestamp: "" },
    ];

    const tokenInfoMap = new Map<string, TokenInfo>([
      ["0.0.1001", createTokenInfo("0.0.1001", { decimals: "0" })],
      ["0.0.1002", createTokenInfo("0.0.1002", { decimals: "0" })],
      ["0.0.1003", createTokenInfo("0.0.1003", { decimals: "0" })],
    ]);

    const client = createMockClient(
      createAccountInfo(),
      tokenBalances,
      tokenInfoMap
    );

    const result = await computePortfolioMetric(client, {
      accountId: testAccountId,
    });

    expect(result.fungibleTokens[0].tokenId).toBe("0.0.1002");
    expect(result.fungibleTokens[1].tokenId).toBe("0.0.1003");
    expect(result.fungibleTokens[2].tokenId).toBe("0.0.1001");
  });

  it("includes token metadata", async () => {
    const tokenBalances: AccountTokenBalance[] = [
      { token_id: "0.0.1001", balance: 100000000, created_timestamp: "" },
    ];

    const tokenInfoMap = new Map<string, TokenInfo>([
      [
        "0.0.1001",
        createTokenInfo("0.0.1001", {
          name: "My Token",
          symbol: "MYT",
          decimals: "6",
        }),
      ],
    ]);

    const client = createMockClient(
      createAccountInfo(),
      tokenBalances,
      tokenInfoMap
    );

    const result = await computePortfolioMetric(client, {
      accountId: testAccountId,
    });

    expect(result.fungibleTokens[0].name).toBe("My Token");
    expect(result.fungibleTokens[0].symbol).toBe("MYT");
    expect(result.fungibleTokens[0].decimals).toBe(6);
  });

  it("handles missing token metadata gracefully", async () => {
    const tokenBalances: AccountTokenBalance[] = [
      { token_id: "0.0.1001", balance: 100, created_timestamp: "" },
      { token_id: "0.0.1002", balance: 200, created_timestamp: "" }, // No info available
    ];

    const tokenInfoMap = new Map<string, TokenInfo>([
      ["0.0.1001", createTokenInfo("0.0.1001")],
      // 0.0.1002 intentionally missing
    ]);

    const client = createMockClient(
      createAccountInfo(),
      tokenBalances,
      tokenInfoMap
    );

    const result = await computePortfolioMetric(client, {
      accountId: testAccountId,
    });

    // Should only include the token we have info for
    expect(result.fungibleTokens).toHaveLength(1);
    expect(result.fungibleTokens[0].tokenId).toBe("0.0.1001");
  });

  it("includes timestamp in result", async () => {
    const client = createMockClient(createAccountInfo(), []);

    const before = new Date().toISOString();
    const result = await computePortfolioMetric(client, {
      accountId: testAccountId,
    });
    const after = new Date().toISOString();

    expect(result.timestamp >= before).toBe(true);
    expect(result.timestamp <= after).toBe(true);
  });

  it("reports correct token count", async () => {
    const tokenBalances: AccountTokenBalance[] = [
      { token_id: "0.0.1001", balance: 100, created_timestamp: "" },
      { token_id: "0.0.1002", balance: 200, created_timestamp: "" },
      { token_id: "0.0.1003", balance: 5, created_timestamp: "" },
    ];

    const tokenInfoMap = new Map<string, TokenInfo>([
      ["0.0.1001", createTokenInfo("0.0.1001")],
      ["0.0.1002", createTokenInfo("0.0.1002")],
      ["0.0.1003", createTokenInfo("0.0.1003", { type: "NON_FUNGIBLE_UNIQUE" })],
    ]);

    const client = createMockClient(
      createAccountInfo(),
      tokenBalances,
      tokenInfoMap
    );

    const result = await computePortfolioMetric(client, {
      accountId: testAccountId,
    });

    expect(result.tokenCount).toBe(3);
  });
});
