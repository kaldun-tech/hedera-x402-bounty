# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hedera x402 bounty project implementing an HCS (Hedera Consensus Service) message archive with x402 micropayments. Users pay via x402 protocol to access historical HCS messages.

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
- **Hedera**: HBAR payments via testnet, HCS message indexing
- **Facilitator**: blocky402 (`https://api.testnet.blocky402.com`) or self-hosted
- **Stack**: TypeScript, Hono (API server), PostgreSQL (message storage), postgres.js

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

## Architecture (Planned)

```
HCS Indexer (mirror node subscription)
    │
    ▼
PostgreSQL (topic_id, sequence_number, timestamp, message, payer)
    │
    ▼
Hono API Server
  ├── GET /topics                  [free]
  ├── GET /topics/:id/recent       [free - last 24h]
  ├── GET /topics/:id/messages     [paid - x402]
  ├── GET /topics/:id/search       [paid - x402]
  └── GET /topics/:id/export       [paid - higher tier]
```

## Environment Variables

```bash
# Hedera
HEDERA_NETWORK=hedera:testnet
PAY_TO_ACCOUNT=0.0.xxxx           # Receiver account

# Facilitator
FACILITATOR_URL=https://api.testnet.blocky402.com

# Database
DATABASE_URL=postgresql://...

# Client (for testing)
HEDERA_CLIENT_ID=0.0.yyyy
HEDERA_CLIENT_KEY=ecdsa_private_key
```

## Reference Implementations

- matevszm/x402-hedera-example: Pay-per-call API pattern
- hedera-dev/scaffold-hbar (x402-pay-per-use): Full marketplace scaffold
