# Testing Guide

This guide covers troubleshooting and success criteria for the x402 payment flow. For setup and basic testing steps, see the [README](./README.md).

## Troubleshooting

### "Invalid HEDERA_CLIENT_ID format"
- Ensure format is `0.0.XXXXX` (three parts, dot-separated)
- Check `.env` file has no extra spaces

### "Failed to parse private key"
- Ensure you're using an **ECDSA** key, not ED25519
- Key should be hex format (starts with `302e02...` or raw hex)
- Check for copy/paste errors (no line breaks)

### "Account not found" or "insufficient balance"
- Verify account exists on testnet: `https://hashscan.io/testnet/account/0.0.XXXXX`
- Claim more testnet HBAR from the [portal faucet](https://portal.hedera.com/)

### "Facilitator error" or timeout
- The blocky402 facilitator may be down temporarily
- Try again in a few minutes
- Check facilitator status: `curl https://api.testnet.blocky402.com/health`

### Connection refused to localhost:4021
- Ensure the server is running (`npm run dev`)
- Check the PORT in `.env` matches

### Self-payment error
- `PAY_TO_ACCOUNT` and `HEDERA_CLIENT_ID` **must be different accounts**
- The x402 protocol cannot process payments where payer === payee
- Create two separate testnet accounts at https://portal.hedera.com/

## Success Criteria

For a complete bounty submission:

1. **Working server** - Returns 402 for paid endpoints, 200 after payment
2. **Successful test client run** - All 3 endpoints return data (`npm run test:client`)
3. **Transaction IDs** - Returned in `x-payment-response` header
4. **On-chain verification** - Transactions visible on [HashScan](https://hashscan.io/testnet)

## Verified Transactions

Example successful transaction:
- https://hashscan.io/testnet/transaction/0.0.7162784@1784497307.292354716
