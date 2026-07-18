/**
 * Types for Hedera Mirror Node REST API responses
 * Reference: https://docs.hedera.com/hedera/sdks-and-apis/rest-api
 */

export interface MirrorNodeLinks {
  next: string | null;
}

// Account types
export interface AccountBalance {
  balance: number;
  timestamp: string;
  tokens: TokenBalance[];
}

export interface TokenBalance {
  token_id: string;
  balance: number;
}

export interface AccountInfo {
  account: string;
  balance: AccountBalance;
  created_timestamp: string;
  deleted: boolean;
  memo: string;
  evm_address: string | null;
}

export interface AccountResponse {
  accounts: AccountInfo[];
  links: MirrorNodeLinks;
}

// Transaction types
export interface Transfer {
  account: string | null;
  amount: number;
  is_approval: boolean;
}

export interface TokenTransfer {
  account: string | null;
  amount: number;
  token_id: string;
  is_approval: boolean;
}

export interface Transaction {
  consensus_timestamp: string;
  transaction_id: string;
  name: string;
  result: string;
  transfers: Transfer[];
  token_transfers: TokenTransfer[];
  charged_tx_fee: number;
  valid_start_timestamp: string;
  node: string | null;
  memo_base64: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  links: MirrorNodeLinks;
}

// Token types
export interface TokenInfo {
  token_id: string;
  name: string;
  symbol: string;
  decimals: string;
  total_supply: string;
  type: "FUNGIBLE_COMMON" | "NON_FUNGIBLE_UNIQUE";
  treasury_account_id: string;
  created_timestamp: string;
}

export interface TokenResponse {
  tokens: TokenInfo[];
  links: MirrorNodeLinks;
}

export interface TokenBalanceEntry {
  account: string;
  balance: number;
}

export interface TokenBalancesResponse {
  timestamp: string;
  balances: TokenBalanceEntry[];
  links: MirrorNodeLinks;
}

// Account tokens response
export interface AccountTokenBalance {
  token_id: string;
  balance: number;
  created_timestamp: string;
}

export interface AccountTokensResponse {
  tokens: AccountTokenBalance[];
  links: MirrorNodeLinks;
}
