/**
 * x402 Payment Middleware Configuration
 *
 * Sets up the x402 payment protocol for protected endpoints.
 * Uses the blocky402 facilitator on testnet for payment processing.
 */

import {
  paymentMiddlewareFromConfig,
  x402ResourceServer,
  type RoutesConfig,
} from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactHederaScheme, HEDERA_TESTNET_CAIP2 } from "@x402/hedera";
import type { Network } from "@x402/core/types";
import { config } from "../config.js";

// Asset ID for native HBAR
const HBAR_ASSET = "0.0.0";

// Prices in tinybars (1 HBAR = 100,000,000 tinybars)
const PRICES = {
  accountActivity: "2000000", // 0.02 HBAR
  tokenDistribution: "5000000", // 0.05 HBAR
  portfolioSnapshot: "3000000", // 0.03 HBAR
} as const;

/**
 * Route configurations for x402-protected endpoints
 */
export const x402Routes: RoutesConfig = {
  "GET /metrics/account/:id/activity": {
    accepts: {
      scheme: "exact",
      network: config.hederaNetwork as Network,
      payTo: config.payToAccount,
      price: {
        amount: PRICES.accountActivity,
        asset: HBAR_ASSET,
      },
      maxTimeoutSeconds: 60,
    },
    description: "Account activity metrics including transaction count and volume",
    resource: "account-activity",
  },
  "GET /metrics/token/:id/distribution": {
    accepts: {
      scheme: "exact",
      network: config.hederaNetwork as Network,
      payTo: config.payToAccount,
      price: {
        amount: PRICES.tokenDistribution,
        asset: HBAR_ASSET,
      },
      maxTimeoutSeconds: 60,
    },
    description: "Token holder distribution and concentration metrics",
    resource: "token-distribution",
  },
  "GET /metrics/account/:id/portfolio": {
    accepts: {
      scheme: "exact",
      network: config.hederaNetwork as Network,
      payTo: config.payToAccount,
      price: {
        amount: PRICES.portfolioSnapshot,
        asset: HBAR_ASSET,
      },
      maxTimeoutSeconds: 60,
    },
    description: "Complete portfolio snapshot with all token holdings",
    resource: "portfolio-snapshot",
  },
};

/**
 * Creates the x402 payment middleware for Hono
 */
export function createPaymentMiddleware() {
  const facilitator = new HTTPFacilitatorClient({
    url: config.facilitatorUrl,
  });

  // Determine network for scheme registration
  const network =
    config.hederaNetwork === "hedera:mainnet"
      ? "hedera:mainnet"
      : HEDERA_TESTNET_CAIP2;

  return paymentMiddlewareFromConfig(
    x402Routes,
    facilitator,
    [
      {
        network: network as Network,
        server: new ExactHederaScheme(),
      },
    ],
    {
      // Paywall configuration for browser requests
      title: "Hedera Metrics API",
      description: "Pay-per-query access to Hedera network analytics",
    }
  );
}
