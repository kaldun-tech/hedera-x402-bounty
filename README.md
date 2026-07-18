# Hedera Mirror Node Metrics API

Pay-per-query analytics API for Hedera network data, powered by [x402](https://www.x402.org/) micropayments.

Built for the **Hedera x402 Bounty** (July 2026).

## Overview

This API provides computed analytics derived from Hedera mirror node data. Unlike raw mirror node access (which is free), this service offers processed metrics with real analytical value—and charges micropayments via the x402 protocol.

**Key features:**
- Pay only for what you use (0.02-0.05 HBAR per query)
- No accounts or API keys required
- Machine-to-machine ready (AI agents can pay autonomously)
- Real-time data from Hedera mirror node

## How x402 Works

```
┌──────────┐                      ┌──────────┐                    ┌─────────────┐
│  Client  │                      │  Server  │                    │ Facilitator │
└────┬─────┘                      └────┬─────┘                    └──────┬──────┘
     │                                 │                                 │
     │  GET /metrics/account/0.0.98    │                                 │
     ├────────────────────────────────►│                                 │
     │                                 │                                 │
     │  402 Payment Required           │                                 │
     │  x-payment: {price, payTo...}   │                                 │
     │◄────────────────────────────────┤                                 │
     │                                 │                                 │
     │  [Sign payment with wallet]     │                                 │
     │                                 │                                 │
     │  GET /metrics/account/0.0.98    │                                 │
     │  x-payment: {signature...}      │                                 │
     ├────────────────────────────────►│                                 │
     │                                 │                                 │
     │                                 │  POST /settle                   │
     │                                 ├────────────────────────────────►│
     │                                 │                                 │
     │                                 │  {receipt, transactionId}       │
     │                                 │◄────────────────────────────────┤
     │                                 │                                 │
     │  200 OK + data + receipt        │                                 │
     │◄────────────────────────────────┤                                 │
     │                                 │                                 │
```

The facilitator handles transaction submission and pays network fees, making micropayments economically viable.

## API Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /health` | Free | Health check |
| `GET /catalog` | Free | List available data products |
| `GET /metrics/account/:id/activity` | 0.02 HBAR | Account activity score & stats |
| `GET /metrics/token/:id/distribution` | 0.05 HBAR | Token holder concentration metrics |
| `GET /metrics/account/:id/portfolio` | 0.03 HBAR | Full portfolio snapshot |

## Quick Start

### Server Setup

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/hedera-x402-bounty.git
cd hedera-x402-bounty
npm install

# Configure
cp .env.example .env
# Edit .env - set PAY_TO_ACCOUNT to your Hedera account

# Start server
npm run dev
```

Server runs at `http://localhost:4021`.

### Test Free Endpoints

```bash
# Health check
curl http://localhost:4021/health

# View available products
curl http://localhost:4021/catalog
```

### Test Paid Endpoints (Expect 402)

```bash
curl -i http://localhost:4021/metrics/account/0.0.98/activity
# Returns: HTTP 402 Payment Required
```

## Client Usage

### Using the Test Client

The included test client demonstrates the full payment flow:

```bash
# Configure client credentials in .env
HEDERA_CLIENT_ID=0.0.YOUR_ACCOUNT
HEDERA_CLIENT_KEY=your_ecdsa_private_key

# Run the test client
npm run test:client
```

### Programmatic Client (TypeScript)

```typescript
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";

// Set up signer with your Hedera credentials
const privateKey = PrivateKey.fromStringECDSA(process.env.HEDERA_CLIENT_KEY);
const signer = createClientHederaSigner(
  process.env.HEDERA_CLIENT_ID,
  privateKey,
  { network: "hedera:testnet" }
);

// Create x402 client
const client = new x402Client().register("hedera:*", new ExactHederaScheme(signer));
const httpClient = new x402HTTPClient(client);

// Make a paid request
async function fetchAccountActivity(accountId: string) {
  const url = `http://localhost:4021/metrics/account/${accountId}/activity`;

  // Step 1: Initial request returns 402
  const initial = await fetch(url);

  if (initial.status === 402) {
    // Step 2: Parse payment requirements
    const paymentRequired = httpClient.getPaymentRequiredResponse(
      (header) => initial.headers.get(header)
    );

    // Step 3: Sign payment
    const payload = await httpClient.createPaymentPayload(paymentRequired);
    const headers = httpClient.encodePaymentSignatureHeader(payload);

    // Step 4: Retry with payment
    const paid = await fetch(url, { headers });
    return paid.json();
  }

  return initial.json();
}

const data = await fetchAccountActivity("0.0.98");
console.log(data);
```

## Data Products

### Account Activity (`/metrics/account/:id/activity`)

Analyzes transaction history for any Hedera account.

**Parameters:**
- `days` (optional): Lookback period, 1-90 (default: 30)

**Response:**
```json
{
  "product": "account-activity",
  "price": 0.02,
  "data": {
    "accountId": "0.0.98",
    "period": { "days": 30, "start": "2026-06-18T...", "end": "2026-07-18T..." },
    "transactionCount": 1523,
    "hbarVolume": { "in": "45.23", "out": "12.87", "net": "32.36" },
    "uniqueCounterparties": 47,
    "activityScore": 78.5
  }
}
```

### Token Distribution (`/metrics/token/:id/distribution`)

Calculates holder concentration metrics for any fungible token.

**Response:**
```json
{
  "product": "token-distribution",
  "price": 0.05,
  "data": {
    "tokenId": "0.0.456858",
    "tokenInfo": { "name": "Example Token", "symbol": "EXT", "decimals": 8 },
    "totalHolders": 1247,
    "giniCoefficient": 0.73,
    "concentration": {
      "top1Percent": 0.45,
      "top10Percent": 0.82
    },
    "topHolders": [
      { "account": "0.0.12345", "balance": "50000000", "percentage": 25.5 }
    ]
  }
}
```

### Portfolio Snapshot (`/metrics/account/:id/portfolio`)

Returns complete holdings for an account.

**Response:**
```json
{
  "product": "portfolio-snapshot",
  "price": 0.03,
  "data": {
    "accountId": "0.0.98",
    "hbar": { "balance": "1234.56789012", "tinybars": "123456789012" },
    "tokens": [
      {
        "tokenId": "0.0.456858",
        "name": "Example Token",
        "symbol": "EXT",
        "balance": "1000.00",
        "decimals": 8
      }
    ],
    "nfts": [
      { "tokenId": "0.0.789", "serialNumbers": [1, 5, 12] }
    ],
    "timestamp": "2026-07-18T14:30:00Z"
  }
}
```

## Configuration

### Environment Variables

```bash
# Required
PAY_TO_ACCOUNT=0.0.XXXXXX           # Account to receive payments

# Optional (defaults shown)
HEDERA_NETWORK=hedera:testnet       # hedera:testnet or hedera:mainnet
FACILITATOR_URL=https://api.testnet.blocky402.com
MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com
PORT=4021

# Client (for test script)
HEDERA_CLIENT_ID=0.0.XXXXXX         # Payer account
HEDERA_CLIENT_KEY=302e02...         # ECDSA private key (hex)
```

> **Important:** `PAY_TO_ACCOUNT` and `HEDERA_CLIENT_ID` must be **different accounts**. The x402 protocol cannot process self-payments (payer === payee). Create two separate testnet accounts at https://portal.hedera.com/.

## Testing

```bash
# Unit tests
npm run test:run

# Type checking
npm run typecheck

# Lint
npm run lint
```

### End-to-End Testing

See [TESTING.md](./TESTING.md) for detailed instructions on running the full payment flow with real testnet transactions.

## On-Chain Proof

Each successful API call generates a Hedera transaction. Transaction IDs are returned in the `x-payment-response` header and can be verified on [HashScan](https://hashscan.io/testnet).

Example transaction verification:
```bash
# Using HashScan
https://hashscan.io/testnet/transaction/0.0.12345@1234567890.123456789

# Using Mirror Node API
curl "https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.12345-1234567890-123456789"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Server (Hono)                        │
├─────────────────────────────────────────────────────────────────┤
│  GET /health          │  Free  │  Server health check           │
│  GET /catalog         │  Free  │  List products & prices        │
│  GET /metrics/*       │  Paid  │  Protected by x402 middleware  │
└───────────┬─────────────────────────────────┬───────────────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────────────┐
│   Metrics Providers   │         │      x402 Middleware          │
│  ├─ activity.ts       │         │  ├─ Issues 402 challenges     │
│  ├─ distribution.ts   │         │  ├─ Validates signatures      │
│  └─ portfolio.ts      │         │  └─ Settles via facilitator   │
└───────────┬───────────┘         └───────────────────────────────┘
            │
            ▼
┌───────────────────────┐
│    Mirror Client      │
│  ├─ Pagination        │
│  ├─ Error handling    │
│  └─ Type safety       │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Hedera Mirror Node   │
│  (testnet/mainnet)    │
└───────────────────────┘
```

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** [Hono](https://hono.dev/) (lightweight, fast)
- **Payments:** [@x402/hedera](https://www.x402.org/) (x402 protocol)
- **Data Source:** Hedera Mirror Node REST API
- **Testing:** [Vitest](https://vitest.dev/)
- **Language:** TypeScript

## Project Structure

```
├── scripts/
│   └── test-client.ts      # x402 payment flow demo
├── src/
│   ├── config.ts           # Environment configuration
│   ├── index.ts            # Server entrypoint
│   ├── mirror/
│   │   ├── client.ts       # Mirror node client with pagination
│   │   └── types.ts        # API response types
│   ├── metrics/
│   │   ├── activity.ts     # Account activity computation
│   │   ├── distribution.ts # Token distribution computation
│   │   ├── portfolio.ts    # Portfolio snapshot computation
│   │   └── __tests__/      # Unit tests
│   └── server/
│       ├── app.ts          # Hono routes & handlers
│       ├── x402.ts         # Payment middleware
│       └── __tests__/      # API tests
├── CLAUDE.md               # AI assistant context
├── PLAN.md                 # Implementation roadmap
└── TESTING.md              # E2E testing guide
```

## License

MIT
