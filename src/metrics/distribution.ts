/**
 * Token Distribution Metric
 *
 * Analyzes holder concentration for a Hedera fungible token:
 * - Total holder count
 * - Top holders with percentages
 * - Gini coefficient (0 = perfect equality, 1 = perfect inequality)
 * - Concentration metrics (top 1%, 10%, 50% holdings)
 */

import type { MirrorClient } from "../mirror/client.js";
import type { TokenInfo } from "../mirror/types.js";

export interface DistributionMetricParams {
  tokenId: string;
}

export interface HolderEntry {
  account: string;
  balance: number;
  percentage: number;
}

export interface DistributionMetricResult {
  tokenId: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  totalSupply: string;
  totalHolders: number;
  topHolders: HolderEntry[];
  giniCoefficient: number;
  concentration: {
    top1Percent: number;
    top10Percent: number;
    top50Percent: number;
  };
  timestamp: string;
}

/**
 * Calculate Gini coefficient from sorted balances (descending)
 *
 * Gini = (2 * sum(i * x_i)) / (n * sum(x_i)) - (n + 1) / n
 * Where x_i are values sorted ascending and i is 1-indexed position
 */
function calculateGini(balances: number[]): number {
  if (balances.length === 0) return 0;
  if (balances.length === 1) return 0;

  // Sort ascending for Gini calculation
  const sorted = [...balances].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((sum, val) => sum + val, 0);

  if (total === 0) return 0;

  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * sorted[i];
  }

  const gini = (2 * weightedSum) / (n * total) - (n + 1) / n;
  return Math.round(Math.max(0, Math.min(1, gini)) * 10000) / 10000;
}

/**
 * Calculate what percentage of total supply is held by top N% of holders
 */
function calculateConcentration(
  sortedBalances: number[],
  totalSupply: number,
  topPercent: number
): number {
  if (sortedBalances.length === 0 || totalSupply === 0) return 0;

  const topCount = Math.max(1, Math.ceil(sortedBalances.length * (topPercent / 100)));
  const topSum = sortedBalances.slice(0, topCount).reduce((sum, val) => sum + val, 0);

  return Math.round((topSum / totalSupply) * 10000) / 100;
}

/**
 * Compute token distribution metrics
 */
export async function computeDistributionMetric(
  client: MirrorClient,
  params: DistributionMetricParams
): Promise<DistributionMetricResult> {
  // Fetch token info
  const tokenInfo = await client.getToken(params.tokenId);
  if (!tokenInfo) {
    throw new TokenNotFoundError(params.tokenId);
  }

  // Fetch all holder balances (up to 10 pages = 1000 holders)
  const balances = await client.getTokenBalances(params.tokenId, { maxPages: 10 });

  // Sort by balance descending
  const sortedBalances = balances
    .map((b) => b.balance)
    .sort((a, b) => b - a);

  const totalHeld = sortedBalances.reduce((sum, val) => sum + val, 0);
  const decimals = parseInt(tokenInfo.decimals, 10);
  const divisor = Math.pow(10, decimals);

  // Build top holders list (top 10)
  const topHolders: HolderEntry[] = balances
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10)
    .map((holder) => ({
      account: holder.account,
      balance: holder.balance / divisor,
      percentage:
        totalHeld > 0
          ? Math.round((holder.balance / totalHeld) * 10000) / 100
          : 0,
    }));

  // Calculate metrics
  const gini = calculateGini(sortedBalances);

  return {
    tokenId: params.tokenId,
    tokenName: tokenInfo.name,
    tokenSymbol: tokenInfo.symbol,
    decimals,
    totalSupply: tokenInfo.total_supply,
    totalHolders: balances.length,
    topHolders,
    giniCoefficient: gini,
    concentration: {
      top1Percent: calculateConcentration(sortedBalances, totalHeld, 1),
      top10Percent: calculateConcentration(sortedBalances, totalHeld, 10),
      top50Percent: calculateConcentration(sortedBalances, totalHeld, 50),
    },
    timestamp: new Date().toISOString(),
  };
}

export class TokenNotFoundError extends Error {
  constructor(tokenId: string) {
    super(`Token not found: ${tokenId}`);
    this.name = "TokenNotFoundError";
  }
}
