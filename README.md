# HCS Message Archive

Pay-per-query access to Hedera Consensus Service message history via [x402](https://www.x402.org/) micropayments.

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your PAY_TO_ACCOUNT and DATABASE_URL

# Run database migrations
psql $DATABASE_URL < src/db/schema.sql

# Start dev server
npm run dev
```

## API Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /topics` | Free | List indexed topics |
| `GET /topics/:id/recent` | Free | Last 24h messages |
| `GET /topics/:id/messages` | 0.01 HBAR | Full archive (paginated) |
| `GET /topics/:id/search` | 0.02 HBAR | Search messages |
| `GET /topics/:id/export` | 0.05 HBAR | Bulk export |

## License

MIT
