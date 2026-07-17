# Hedera Mirror Node Metrics API

Pay-per-query access to computed analytics from Hedera mirror node data via [x402](https://www.x402.org/) micropayments.

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your PAY_TO_ACCOUNT

# Start dev server
npm run dev
```

## API Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /health` | Free | Health check |
| `GET /catalog` | Free | List available data products |
| `GET /metrics/account/:id/activity` | 0.02 HBAR | Account activity score & stats |
| `GET /metrics/token/:id/distribution` | 0.05 HBAR | Token holder concentration metrics |
| `GET /metrics/account/:id/portfolio` | 0.03 HBAR | Full portfolio snapshot |

## How It Works

1. Client requests a paid endpoint
2. Server returns HTTP 402 with payment details in `x-payment` header
3. Client signs payment via x402 protocol
4. Client retries with signed payment in header
5. Server verifies payment via facilitator and returns data

## Data Products

### Account Activity (`/metrics/account/:id/activity`)

Computes activity metrics for any Hedera account:
- Transaction count over period
- HBAR volume (in/out)
- Unique counterparties
- Computed "activity score"

Query params: `?days=30` (default 30, max 90)

### Token Distribution (`/metrics/token/:id/distribution`)

Analyzes holder concentration for any fungible token:
- Total holders count
- Top 10 holders with percentages
- Gini coefficient (0 = equal, 1 = concentrated)
- Concentration metrics (top 1%, 10% holdings)

### Portfolio Snapshot (`/metrics/account/:id/portfolio`)

Returns complete holdings for an account:
- HBAR balance
- All token balances with metadata
- NFT holdings
- Approximate USD values (when available)

## License

MIT
