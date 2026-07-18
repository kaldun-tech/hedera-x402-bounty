# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hedera x402 bounty project implementing a **pay-per-query analytics API** for Hedera mirror node data. Users pay via x402 protocol to access computed metrics derived from Hedera network activity.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Run dev server with hot reload (port 4021)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled server
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run lint         # Run ESLint
npm run typecheck    # Type check without emitting
```

## Key Technologies

- **x402 Protocol**: HTTP 402-based payment standard (`@x402/core`, `@x402/hedera`)
- **Hedera**: HBAR payments via testnet
- **Mirror Node**: REST API for historical network data (mainnet/testnet)
- **Facilitator**: blocky402 (`https://api.testnet.blocky402.com`) or self-hosted
- **Stack**: TypeScript, Hono (API server), Vitest (testing)

## x402 Integration Pattern

Server setup:
```typescript
import { x402ResourceServer, ExactHederaScheme, HTTPFacilitatorClient } from "@x402/hedera";

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const x402Server = new x402ResourceServer(facilitator)
  .register("hedera:*", new ExactHederaScheme());
```

Client setup:
```typescript
import { x402Client, createClientHederaSigner, ExactHederaScheme, wrapFetchWithPayment } from "@x402/hedera";

const signer = createClientHederaSigner(accountId, privateKey, { network: "hedera:testnet" });
const client = new x402Client().register("hedera:*", new ExactHederaScheme(signer));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
```

## Architecture

```
Hedera Mirror Node (REST API)
    │
    ▼
Mirror Node Client (src/mirror/client.ts)
    │
    ▼
Metrics Providers (src/metrics/*.ts)
    │
    ▼
Hono API Server (src/server/app.ts)
  ├── GET /health                              [free]
  ├── GET /catalog                             [free - list products]
  ├── GET /metrics/account/:id/activity        [paid - 0.02 HBAR]
  ├── GET /metrics/token/:id/distribution      [paid - 0.05 HBAR]
  └── GET /metrics/account/:id/portfolio       [paid - 0.03 HBAR]
```

## Data Products

| Product | Endpoint | Price | Description |
|---------|----------|-------|-------------|
| Account Activity | `/metrics/account/:id/activity` | 0.02 HBAR | Txn count, volume, counterparties over N days |
| Token Distribution | `/metrics/token/:id/distribution` | 0.05 HBAR | Holder concentration metrics (Gini coefficient) |
| Portfolio Snapshot | `/metrics/account/:id/portfolio` | 0.03 HBAR | All balances, tokens, NFTs with values |

## Environment Variables

```bash
# Hedera
HEDERA_NETWORK=hedera:testnet
PAY_TO_ACCOUNT=0.0.xxxx           # Receiver account

# Facilitator
FACILITATOR_URL=https://api.testnet.blocky402.com

# Mirror Node (optional - defaults to public endpoints)
MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com

# Client (for testing)
HEDERA_CLIENT_ID=0.0.yyyy
HEDERA_CLIENT_KEY=ecdsa_private_key
```

## Mirror Node API Reference

Base URLs:
- Testnet: `https://testnet.mirrornode.hedera.com`
- Mainnet: `https://mainnet.mirrornode.hedera.com`

Key endpoints:
- `GET /api/v1/accounts/{id}` - Account info and balances
- `GET /api/v1/accounts/{id}/tokens` - Token balances
- `GET /api/v1/transactions?account.id={id}` - Transaction history
- `GET /api/v1/tokens/{id}` - Token info
- `GET /api/v1/tokens/{id}/balances` - All holders of a token

## Implementation Status

See `PLAN.md` for full implementation checklist and progress tracking.

**Completed:** Items 1-3 (data products) + x402 middleware + Item 8 (test client)
**Next:** Item 9 (End-to-End Testing) - run `npm run test:client` with real credentials

## Reference Implementations

- matevszm/x402-hedera-example: Pay-per-call API pattern
- hedera-dev/scaffold-hbar (x402-pay-per-use): Full marketplace scaffold
