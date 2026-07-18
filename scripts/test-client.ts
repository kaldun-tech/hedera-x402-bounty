#!/usr/bin/env npx tsx
/**
 * x402 Test Client
 *
 * Demonstrates the full x402 payment flow:
 * 1. Request a paid endpoint → receive HTTP 402
 * 2. Sign payment with Hedera private key
 * 3. Retry with payment header → receive data + settlement receipt
 *
 * Usage:
 *   npx tsx scripts/test-client.ts
 *
 * Required environment variables:
 *   HEDERA_CLIENT_ID   - Hedera account ID (e.g., 0.0.12345)
 *   HEDERA_CLIENT_KEY  - ECDSA private key (hex, with or without 0x prefix)
 *
 * Optional:
 *   SERVER_URL         - API server URL (default: http://localhost:4021)
 */

import "dotenv/config";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";

// Configuration
const SERVER_URL = process.env.SERVER_URL || "http://localhost:4021";
const CLIENT_ID = process.env.HEDERA_CLIENT_ID;
const CLIENT_KEY = process.env.HEDERA_CLIENT_KEY;
const NETWORK = process.env.HEDERA_NETWORK || "hedera:testnet";
const FETCH_TIMEOUT_MS = 30_000; // 30 second timeout for requests

// ANSI colors for output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

function log(label: string, value: string, color = colors.reset) {
  console.log(`${color}${label}${colors.reset} ${value}`);
}

function logJson(label: string, obj: unknown) {
  console.log(`${colors.blue}${label}${colors.reset}`);
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  console.log("\n=== x402 Test Client ===\n");

  // Validate environment
  if (!CLIENT_ID || !CLIENT_KEY) {
    console.error(`${colors.red}Error:${colors.reset} Missing required environment variables.`);
    console.error("Set HEDERA_CLIENT_ID and HEDERA_CLIENT_KEY in .env or environment.\n");
    console.error("Example:");
    console.error("  HEDERA_CLIENT_ID=0.0.12345");
    console.error("  HEDERA_CLIENT_KEY=302e020100300506032b6570... (hex ECDSA key)\n");
    process.exit(1);
  }

  // Validate account ID format
  if (!/^0\.0\.\d+$/.test(CLIENT_ID)) {
    console.error(`${colors.red}Error:${colors.reset} Invalid HEDERA_CLIENT_ID format.`);
    console.error(`Got: ${CLIENT_ID}`);
    console.error("Expected format: 0.0.12345\n");
    process.exit(1);
  }

  // Validate private key looks like a real key (not a placeholder)
  if (CLIENT_KEY.length < 32 || CLIENT_KEY.includes("your_")) {
    console.error(`${colors.red}Error:${colors.reset} HEDERA_CLIENT_KEY appears to be a placeholder.`);
    console.error("Please set a real ECDSA private key from your Hedera testnet account.\n");
    console.error("You can create a testnet account at: https://portal.hedera.com/\n");
    process.exit(1);
  }

  // Validate network
  if (NETWORK !== "hedera:testnet" && NETWORK !== "hedera:mainnet") {
    console.error(`${colors.red}Error:${colors.reset} Invalid HEDERA_NETWORK.`);
    console.error(`Got: ${NETWORK}`);
    console.error("Expected: hedera:testnet or hedera:mainnet\n");
    process.exit(1);
  }

  log("Server:", SERVER_URL, colors.blue);
  log("Client Account:", CLIENT_ID, colors.blue);
  log("Network:", NETWORK, colors.blue);
  console.log();

  // Set up x402 client
  let privateKey;
  try {
    privateKey = PrivateKey.fromStringECDSA(CLIENT_KEY);
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset} Failed to parse private key.`);
    console.error("Ensure HEDERA_CLIENT_KEY is a valid ECDSA private key in hex format.");
    console.error(`Details: ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
  const signer = createClientHederaSigner(CLIENT_ID, privateKey, {
    network: NETWORK as "hedera:testnet" | "hedera:mainnet",
  });

  const client = new x402Client().register("hedera:*", new ExactHederaScheme(signer));
  const httpClient = new x402HTTPClient(client);

  // Verify server is running
  log("Checking:", "Server connectivity...");
  try {
    const healthResponse = await fetch(`${SERVER_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!healthResponse.ok) {
      throw new Error(`Health check returned ${healthResponse.status}`);
    }
    log("Server:", "Connected ✓", colors.green);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n${colors.red}Error:${colors.reset} Cannot connect to server at ${SERVER_URL}`);
    console.error(`Details: ${message}`);
    console.error("\nMake sure the server is running:");
    console.error("  npm run dev\n");
    process.exit(1);
  }

  // Test endpoints - using known testnet accounts/tokens
  const endpoints = [
    { path: "/metrics/account/0.0.1234/activity?days=7", name: "Account Activity" },
    { path: "/metrics/token/0.0.9631599/distribution", name: "Token Distribution" },
    { path: "/metrics/account/0.0.1234/portfolio", name: "Portfolio Snapshot" },
  ];

  const results: Array<{
    endpoint: string;
    success: boolean;
    transactionId?: string;
    error?: string;
  }> = [];

  for (const { path, name } of endpoints) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`${colors.yellow}Testing: ${name}${colors.reset}`);
    console.log(`${colors.dim}${path}${colors.reset}\n`);

    try {
      const url = `${SERVER_URL}${path}`;

      // Step 1: Initial request (expect 402)
      log("Step 1:", "Sending initial request...");
      const initialResponse = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (initialResponse.status !== 402) {
        if (initialResponse.ok) {
          log("Result:", "Endpoint returned data without payment (unexpected)", colors.yellow);
          const data = await initialResponse.json();
          logJson("Data:", data);
          results.push({ endpoint: path, success: true, transactionId: "none-required" });
          continue;
        }
        throw new Error(`Unexpected status: ${initialResponse.status}`);
      }

      log("Status:", "402 Payment Required ✓", colors.green);

      // Step 2: Parse payment requirements
      log("Step 2:", "Parsing payment requirements...");
      const paymentRequired = httpClient.getPaymentRequiredResponse(
        (headerName) => initialResponse.headers.get(headerName)
      );

      const acceptedPayment = paymentRequired.accepts[0];
      if (!acceptedPayment) {
        throw new Error("No accepted payment options in 402 response");
      }

      log("Pay To:", acceptedPayment.payTo || "unknown", colors.dim);
      log("Amount:", `${acceptedPayment.amount || acceptedPayment.price?.amount || "?"} tinybars`, colors.dim);

      // Debug: show full payment requirements
      if (process.env.DEBUG) {
        console.log(`${colors.dim}Payment requirements:${colors.reset}`);
        console.log(JSON.stringify(paymentRequired, null, 2));
      }

      // Step 3: Create payment signature
      log("Step 3:", "Signing payment...");
      const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
      const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

      log("Signature:", "Created ✓", colors.green);

      // Step 4: Retry with payment
      log("Step 4:", "Sending paid request...");

      if (process.env.DEBUG) {
        console.log(`${colors.dim}Payment headers:${colors.reset}`);
        console.log(JSON.stringify(paymentHeaders, null, 2));
      }

      const paidResponse = await fetch(url, {
        headers: paymentHeaders,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!paidResponse.ok) {
        const errorBody = await paidResponse.text();
        // Also check response headers for error details
        const paymentError = paidResponse.headers.get("payment-required");
        if (process.env.DEBUG && paymentError) {
          console.log(`${colors.dim}Payment error response:${colors.reset}`);
          try {
            const decoded = JSON.parse(Buffer.from(paymentError, "base64").toString());
            console.log(JSON.stringify(decoded, null, 2));
          } catch {
            console.log(paymentError);
          }
        }
        throw new Error(`Payment failed: ${paidResponse.status} - ${errorBody}`);
      }

      log("Status:", `${paidResponse.status} OK ✓`, colors.green);

      // Step 5: Parse settlement response
      const settleResponse = httpClient.getPaymentSettleResponse(
        (headerName) => paidResponse.headers.get(headerName)
      );

      const transactionId = settleResponse?.transaction || "unknown";
      log("Transaction ID:", transactionId, colors.green);

      // Show the data
      const data = await paidResponse.json();
      logJson("Response Data:", data);

      results.push({ endpoint: path, success: true, transactionId });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("Error:", message, colors.red);
      results.push({ endpoint: path, success: false, error: message });
    }
  }

  // Summary
  console.log(`\n${"═".repeat(60)}`);
  console.log(`${colors.yellow}SUMMARY${colors.reset}\n`);

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Total: ${results.length} | Success: ${successful.length} | Failed: ${failed.length}\n`);

  if (successful.length > 0) {
    console.log(`${colors.green}Successful Transactions (on-chain proof):${colors.reset}`);
    for (const r of successful) {
      console.log(`  • ${r.endpoint}`);
      console.log(`    ${colors.dim}TX: ${r.transactionId}${colors.reset}`);
    }
  }

  if (failed.length > 0) {
    console.log(`\n${colors.red}Failed:${colors.reset}`);
    for (const r of failed) {
      console.log(`  • ${r.endpoint}: ${r.error}`);
    }
  }

  console.log();

  // Exit with error if any failed
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
