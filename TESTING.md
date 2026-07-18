# Testing Guide

Follow this guide to test the x402 payment flow end-to-end and generate on-chain proof for the bounty submission.

## Prerequisites

### 1. Hedera Testnet Account

You need a funded Hedera testnet account with an **ECDSA** private key.

**Create one at:** https://portal.hedera.com/
- Sign up / log in
- Create a testnet account
- Note your **Account ID** (e.g., `0.0.5901385`)
- Note your **ECDSA Private Key** (hex format, starts with `302e02...` or `0x...`)
- Claim testnet HBAR from the faucet (you'll need ~1 HBAR for testing)

### 2. Environment Configuration

Update your `.env` file with real credentials:

```bash
# Server config (receiver of payments)
HEDERA_NETWORK=hedera:testnet
PAY_TO_ACCOUNT=0.0.XXXXXX        # Your account that receives payments
FACILITATOR_URL=https://api.testnet.blocky402.com
PORT=4021

# Client config (payer)
HEDERA_CLIENT_ID=0.0.YYYYYY      # Account that pays for API calls
HEDERA_CLIENT_KEY=302e02...      # ECDSA private key (hex)
```

> **Important:** `PAY_TO_ACCOUNT` and `HEDERA_CLIENT_ID` **must be different accounts**. The x402 protocol cannot handle self-payments. Create two separate testnet accounts at https://portal.hedera.com/.

### 3. Verify Dependencies

```bash
npm install
npm run typecheck   # Should pass (ignore @hiero-ledger warnings)
npm run test:run    # Unit tests should pass
```

---

## Testing Steps

### Step 1: Start the Server

In terminal 1:

```bash
npm run dev
```

Expected output:
```
🚀 Server running on http://localhost:4021
   Network: hedera:testnet
   Pay to: 0.0.XXXXXX
```

### Step 2: Test Free Endpoints

In terminal 2, verify the server is working:

```bash
# Health check
curl http://localhost:4021/health

# Should return: {"status":"ok","mirrorNode":"https://testnet.mirrornode.hedera.com"}

# Catalog
curl http://localhost:4021/catalog

# Should return list of products with prices
```

### Step 3: Test Paid Endpoint (Expect 402)

```bash
curl -i http://localhost:4021/metrics/account/0.0.98/activity
```

Expected: **HTTP 402 Payment Required** with `x-payment` header containing payment requirements.

### Step 4: Run the Test Client

This is the main test - it will:
1. Request paid endpoints
2. Receive 402 responses
3. Sign payments with your private key
4. Submit paid requests
5. Display transaction IDs (on-chain proof)

```bash
npm run test:client
```

Expected successful output:
```
=== x402 Test Client ===

Server: http://localhost:4021
Client Account: 0.0.XXXXXX
Network: hedera:testnet

────────────────────────────────────────────────────────────
Testing: Account Activity
/metrics/account/0.0.98/activity?days=7

Step 1: Sending initial request...
Status: 402 Payment Required ✓
Step 2: Parsing payment requirements...
Pay To: 0.0.XXXXXX
Amount: 2000000 tinybars
Step 3: Signing payment...
Signature: Created ✓
Step 4: Sending paid request...
Status: 200 OK ✓
Transaction ID: 0.0.XXXXXX@1234567890.123456789
...

════════════════════════════════════════════════════════════
SUMMARY

Total: 3 | Success: 3 | Failed: 0

Successful Transactions (on-chain proof):
  • /metrics/account/0.0.98/activity?days=7
    TX: 0.0.XXXXXX@1234567890.123456789
  • /metrics/token/0.0.456858/distribution
    TX: 0.0.XXXXXX@1234567890.234567890
  • /metrics/account/0.0.98/portfolio
    TX: 0.0.XXXXXX@1234567890.345678901
```

### Step 5: Verify On-Chain Transactions

Take the transaction IDs from the output and verify them on HashScan:

```
https://hashscan.io/testnet/transaction/0.0.XXXXXX@1234567890.123456789
```

Or use the Hedera mirror node API:
```bash
curl "https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.XXXXXX-1234567890-123456789"
```

---

## Troubleshooting

### "Invalid HEDERA_CLIENT_ID format"
- Ensure format is `0.0.XXXXX` (three parts, dot-separated)
- Check `.env` file has no extra spaces

### "Failed to parse private key"
- Ensure you're using an **ECDSA** key, not ED25519
- Key should be hex format (starts with `302e02...` or raw hex)
- Check for copy/paste errors (no line breaks)

### "Account not found" or "insufficient balance"
- Verify account exists on testnet: https://hashscan.io/testnet/account/0.0.XXXXX
- Claim more testnet HBAR from the portal faucet

### "Facilitator error" or timeout
- The blocky402 facilitator may be down temporarily
- Try again in a few minutes
- Check facilitator status: `curl https://api.testnet.blocky402.com/health`

### Connection refused to localhost:4021
- Ensure the server is running (`npm run dev`)
- Check the PORT in `.env` matches

---

## Success Criteria

For the bounty submission, you need:

1. ✅ **Working server** - Returns 402 for paid endpoints, 200 after payment
2. ✅ **Successful test client run** - All 3 endpoints return data
3. ✅ **Transaction IDs** - Save these as on-chain proof
4. ✅ **HashScan verification** - Transactions visible on testnet explorer

---

## Next Steps After Testing

If all tests pass:

1. **Save transaction IDs** - These are your on-chain proof
2. **Take screenshots** of HashScan showing the transactions
3. **Consider adding more metrics** (items 4-7 in PLAN.md)
4. **Polish README** for submission
5. **Optional:** Deploy to a public URL for the demo

---

*Last updated: July 17, 2026*
