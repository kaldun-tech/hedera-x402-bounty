/**
 * Portfolio Snapshot Metric
 *
 * Returns complete holdings for a Hedera account:
 * - HBAR balance
 * - All fungible token balances with metadata
 * - NFT holdings count by collection
 */

import type { MirrorClient } from "../mirror/client.js";
import type { TokenInfo } from "../mirror/types.js";

export interface PortfolioMetricParams {
  accountId: string;
}

export interface TokenHolding {
  tokenId: string;
  name: string;
  symbol: string;
  type: "FUNGIBLE_COMMON" | "NON_FUNGIBLE_UNIQUE";
  decimals: number;
  balance: number;
  rawBalance: number;
}

export interface PortfolioMetricResult {
  accountId: string;
  hbarBalance: number;
  hbarBalanceTinybar: number;
  tokenCount: number;
  fungibleTokens: TokenHolding[];
  nftCollections: TokenHolding[];
  timestamp: string;
}

const TINYBARS_PER_HBAR = 100_000_000;

/**
 * Compute portfolio snapshot for an account
 */
export async function computePortfolioMetric(
  client: MirrorClient,
  params: PortfolioMetricParams
): Promise<PortfolioMetricResult> {
  // Fetch account info for HBAR balance
  const accountInfo = await client.getAccount(params.accountId);
  if (!accountInfo) {
    throw new AccountNotFoundError(params.accountId);
  }

  const hbarBalanceTinybar = accountInfo.balance.balance;
  const hbarBalance = hbarBalanceTinybar / TINYBARS_PER_HBAR;

  // Fetch all token balances for the account
  const tokenBalances = await client.getAccountTokens(params.accountId, {
    maxPages: 10,
  });

  // Fetch token metadata for each token (in parallel, batched)
  const tokenInfoMap = new Map<string, TokenInfo>();
  const tokenIds = tokenBalances.map((t) => t.token_id);

  // Fetch token info in parallel (limit concurrency to avoid rate limits)
  const BATCH_SIZE = 10;
  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((id) =>
        client.getToken(id).catch((err) => {
          console.warn(`Failed to fetch token info for ${id}:`, err.message);
          return null;
        })
      )
    );
    for (let j = 0; j < batch.length; j++) {
      const info = results[j];
      if (info) {
        tokenInfoMap.set(batch[j], info);
      }
    }
  }

  // Separate fungible tokens and NFTs
  const fungibleTokens: TokenHolding[] = [];
  const nftCollections: TokenHolding[] = [];

  for (const tokenBalance of tokenBalances) {
    const info = tokenInfoMap.get(tokenBalance.token_id);
    if (!info) continue;

    const decimals = parseInt(info.decimals, 10);
    const divisor = Math.pow(10, decimals);

    const holding: TokenHolding = {
      tokenId: tokenBalance.token_id,
      name: info.name,
      symbol: info.symbol,
      type: info.type,
      decimals,
      balance: tokenBalance.balance / divisor,
      rawBalance: tokenBalance.balance,
    };

    if (info.type === "NON_FUNGIBLE_UNIQUE") {
      nftCollections.push(holding);
    } else {
      fungibleTokens.push(holding);
    }
  }

  // Sort by balance descending
  fungibleTokens.sort((a, b) => b.rawBalance - a.rawBalance);
  nftCollections.sort((a, b) => b.rawBalance - a.rawBalance);

  return {
    accountId: params.accountId,
    hbarBalance: Math.round(hbarBalance * 100000000) / 100000000,
    hbarBalanceTinybar,
    tokenCount: tokenBalances.length,
    fungibleTokens,
    nftCollections,
    timestamp: new Date().toISOString(),
  };
}

export class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Account not found: ${accountId}`);
    this.name = "AccountNotFoundError";
  }
}
