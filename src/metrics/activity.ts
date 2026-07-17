/**
 * Account Activity Metric
 *
 * Computes activity statistics for a Hedera account over a time period:
 * - Transaction count
 * - HBAR volume (in/out)
 * - Unique counterparties
 * - Activity score (normalized composite metric)
 */

import type { MirrorClient } from "../mirror/client.js";
import type { Transaction } from "../mirror/types.js";

export interface ActivityMetricParams {
  accountId: string;
  /** Number of days to analyze (default 30, max 90) */
  days?: number;
}

export interface ActivityMetricResult {
  accountId: string;
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  hbarIn: number;
  hbarOut: number;
  hbarNet: number;
  uniqueCounterparties: number;
  activityScore: number;
  breakdown: {
    byType: Record<string, number>;
    successRate: number;
  };
}

const TINYBARS_PER_HBAR = 100_000_000;
const MAX_DAYS = 90;
const DEFAULT_DAYS = 30;

/**
 * Calculate timestamps for the analysis period
 */
function getPeriodTimestamps(days: number): {
  fromTimestamp: string;
  toTimestamp: string;
  periodStart: string;
  periodEnd: string;
} {
  const now = new Date();
  const periodEnd = now.toISOString();
  const toTimestamp = (now.getTime() / 1000).toFixed(9);

  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const periodStart = start.toISOString();
  const fromTimestamp = (start.getTime() / 1000).toFixed(9);

  return { fromTimestamp, toTimestamp, periodStart, periodEnd };
}

/**
 * Extract unique counterparties from transactions
 */
function extractCounterparties(
  transactions: Transaction[],
  accountId: string
): Set<string> {
  const counterparties = new Set<string>();

  for (const tx of transactions) {
    for (const transfer of tx.transfers) {
      if (transfer.account !== accountId && transfer.account !== null) {
        counterparties.add(transfer.account);
      }
    }
    for (const transfer of tx.token_transfers ?? []) {
      if (transfer.account !== accountId && transfer.account !== null) {
        counterparties.add(transfer.account);
      }
    }
  }

  return counterparties;
}

/**
 * Calculate HBAR flows for the account
 */
function calculateHbarFlows(
  transactions: Transaction[],
  accountId: string
): { hbarIn: number; hbarOut: number } {
  let hbarIn = 0;
  let hbarOut = 0;

  for (const tx of transactions) {
    for (const transfer of tx.transfers) {
      if (transfer.account === accountId) {
        if (transfer.amount > 0) {
          hbarIn += transfer.amount;
        } else {
          hbarOut += Math.abs(transfer.amount);
        }
      }
    }
  }

  return {
    hbarIn: hbarIn / TINYBARS_PER_HBAR,
    hbarOut: hbarOut / TINYBARS_PER_HBAR,
  };
}

/**
 * Count transactions by type
 */
function countByType(transactions: Transaction[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tx of transactions) {
    const type = tx.name ?? "UNKNOWN";
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

/**
 * Calculate success rate of transactions
 */
function calculateSuccessRate(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;
  const successful = transactions.filter((tx) => tx.result === "SUCCESS").length;
  return successful / transactions.length;
}

/**
 * Calculate activity score (0-100)
 *
 * Factors:
 * - Transaction frequency (40% weight)
 * - Unique counterparties (30% weight)
 * - HBAR volume (30% weight)
 *
 * Scores are logarithmically scaled to handle wide ranges.
 */
function calculateActivityScore(
  txCount: number,
  counterpartyCount: number,
  hbarVolume: number,
  days: number
): number {
  // Normalize to daily rates
  const dailyTx = txCount / days;
  const dailyVolume = hbarVolume / days;

  // Logarithmic scaling with reasonable bounds
  // tx frequency: 0 = 0, 1/day = 50, 10/day = 75, 100/day = 100
  const txScore = Math.min(100, Math.log10(dailyTx * 10 + 1) * 43);

  // counterparties: 0 = 0, 10 = 50, 100 = 75, 1000 = 100
  const counterpartyScore = Math.min(
    100,
    Math.log10(counterpartyCount + 1) * 33
  );

  // volume: 0 = 0, 10 HBAR/day = 50, 1000/day = 75, 100k/day = 100
  const volumeScore = Math.min(100, Math.log10(dailyVolume * 10 + 1) * 25);

  // Weighted average
  const score = txScore * 0.4 + counterpartyScore * 0.3 + volumeScore * 0.3;

  return Math.round(score * 100) / 100;
}

/**
 * Compute account activity metrics
 */
export async function computeActivityMetric(
  client: MirrorClient,
  params: ActivityMetricParams
): Promise<ActivityMetricResult> {
  const days = Math.min(Math.max(params.days ?? DEFAULT_DAYS, 1), MAX_DAYS);
  const { fromTimestamp, toTimestamp, periodStart, periodEnd } =
    getPeriodTimestamps(days);

  // Fetch transactions for the period
  const transactions = await client.getAccountTransactions(params.accountId, {
    fromTimestamp,
    toTimestamp,
    maxPages: 20, // Up to 2000 transactions
  });

  // Calculate metrics
  const counterparties = extractCounterparties(transactions, params.accountId);
  const { hbarIn, hbarOut } = calculateHbarFlows(transactions, params.accountId);
  const byType = countByType(transactions);
  const successRate = calculateSuccessRate(transactions);
  const totalVolume = hbarIn + hbarOut;

  const activityScore = calculateActivityScore(
    transactions.length,
    counterparties.size,
    totalVolume,
    days
  );

  return {
    accountId: params.accountId,
    periodDays: days,
    periodStart,
    periodEnd,
    transactionCount: transactions.length,
    hbarIn: Math.round(hbarIn * 100) / 100,
    hbarOut: Math.round(hbarOut * 100) / 100,
    hbarNet: Math.round((hbarIn - hbarOut) * 100) / 100,
    uniqueCounterparties: counterparties.size,
    activityScore,
    breakdown: {
      byType,
      successRate: Math.round(successRate * 1000) / 1000,
    },
  };
}
