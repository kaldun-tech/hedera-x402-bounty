/**
 * Hedera Mirror Node REST API Client
 */

import type {
  AccountInfo,
  Transaction,
  TransactionsResponse,
  TokenInfo,
  TokenBalanceEntry,
  TokenBalancesResponse,
  AccountTokenBalance,
  AccountTokensResponse,
} from "./types.js";

export interface MirrorClientOptions {
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

export class MirrorClient {
  private baseUrl: string;
  private timeout: number;

  constructor(options: MirrorClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeout = options.timeout ?? 30000;
  }

  private async fetch<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new MirrorNodeError(
          `Mirror node request failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetches all pages of a paginated endpoint
   */
  private async fetchAllPages<T, R extends { links: { next: string | null } }>(
    initialPath: string,
    extractItems: (response: R) => T[],
    maxPages = 10
  ): Promise<T[]> {
    const items: T[] = [];
    let path: string | null = initialPath;
    let pageCount = 0;

    while (path && pageCount < maxPages) {
      const response: R = await this.fetch<R>(path);
      items.push(...extractItems(response));
      path = response.links.next;
      pageCount++;
    }

    return items;
  }

  /**
   * Get account info by account ID
   */
  async getAccount(accountId: string): Promise<AccountInfo | null> {
    try {
      const response = await this.fetch<AccountInfo>(
        `/api/v1/accounts/${accountId}`
      );
      return response;
    } catch (error) {
      if (error instanceof MirrorNodeError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get transactions for an account within a time range
   */
  async getAccountTransactions(
    accountId: string,
    options: {
      /** Start timestamp (inclusive) */
      fromTimestamp?: string;
      /** End timestamp (exclusive) */
      toTimestamp?: string;
      /** Transaction types to filter */
      transactionType?: string;
      /** Max pages to fetch */
      maxPages?: number;
    } = {}
  ): Promise<Transaction[]> {
    const params = new URLSearchParams();
    params.set("account.id", accountId);
    params.set("order", "desc");
    params.set("limit", "100");

    if (options.fromTimestamp) {
      params.append("timestamp", `gte:${options.fromTimestamp}`);
    }
    if (options.toTimestamp) {
      params.append("timestamp", `lt:${options.toTimestamp}`);
    }
    if (options.transactionType) {
      params.set("transactiontype", options.transactionType);
    }

    return this.fetchAllPages<Transaction, TransactionsResponse>(
      `/api/v1/transactions?${params}`,
      (r) => r.transactions,
      options.maxPages ?? 10
    );
  }

  /**
   * Get token info by token ID
   */
  async getToken(tokenId: string): Promise<TokenInfo | null> {
    try {
      const response = await this.fetch<TokenInfo>(
        `/api/v1/tokens/${tokenId}`
      );
      return response;
    } catch (error) {
      if (error instanceof MirrorNodeError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all token balances (holders) for a token
   */
  async getTokenBalances(
    tokenId: string,
    options: { maxPages?: number } = {}
  ): Promise<TokenBalanceEntry[]> {
    return this.fetchAllPages<TokenBalanceEntry, TokenBalancesResponse>(
      `/api/v1/tokens/${tokenId}/balances?limit=100&order=desc`,
      (r) => r.balances,
      options.maxPages ?? 10
    );
  }

  /**
   * Get all tokens held by an account
   */
  async getAccountTokens(
    accountId: string,
    options: { maxPages?: number } = {}
  ): Promise<AccountTokenBalance[]> {
    return this.fetchAllPages<AccountTokenBalance, AccountTokensResponse>(
      `/api/v1/accounts/${accountId}/tokens?limit=100`,
      (r) => r.tokens,
      options.maxPages ?? 5
    );
  }
}

export class MirrorNodeError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "MirrorNodeError";
  }
}
