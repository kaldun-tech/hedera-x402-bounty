/**
 * x402 Payment Middleware Configuration
 *
 * Sets up the x402 payment protocol for protected endpoints.
 * Uses the blocky402 facilitator on testnet for payment processing.
 */

import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import type { RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
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
 * Helper to get price for a given path
 */
function getPriceForPath(path: string): { amount: string; asset: string } {
  if (path.includes("/activity")) {
    return { amount: PRICES.accountActivity, asset: HBAR_ASSET };
  }
  if (path.includes("/distribution")) {
    return { amount: PRICES.tokenDistribution, asset: HBAR_ASSET };
  }
  if (path.includes("/portfolio")) {
    return { amount: PRICES.portfolioSnapshot, asset: HBAR_ASSET };
  }
  // Default price
  return { amount: PRICES.accountActivity, asset: HBAR_ASSET };
}

/**
 * Route configurations for x402-protected endpoints
 */
export const x402Routes: RoutesConfig = {
  "GET /metrics/account/:id/activity": {
    description: "Account activity metrics including transaction count and volume",
    accepts: {
      scheme: "exact",
      network: config.hederaNetwork as Network,
      payTo: config.payToAccount,
      price: (ctx) => getPriceForPath(ctx.path),
      maxTimeoutSeconds: 60,
    },
  },
  "GET /metrics/token/:id/distribution": {
    description: "Token holder distribution and concentration metrics",
    accepts: {
      scheme: "exact",
      network: config.hederaNetwork as Network,
      payTo: config.payToAccount,
      price: (ctx) => getPriceForPath(ctx.path),
      maxTimeoutSeconds: 60,
    },
  },
  "GET /metrics/account/:id/portfolio": {
    description: "Complete portfolio snapshot with all token holdings",
    accepts: {
      scheme: "exact",
      network: config.hederaNetwork as Network,
      payTo: config.payToAccount,
      price: (ctx) => getPriceForPath(ctx.path),
      maxTimeoutSeconds: 60,
    },
  },
};

/**
 * Creates the x402 payment middleware for Hono
 */
export function createPaymentMiddleware() {
  const facilitator = new HTTPFacilitatorClient({
    url: config.facilitatorUrl,
  });

  // Create x402 server with Hedera scheme registered
  const x402Server = new x402ResourceServer(facilitator).register(
    "hedera:*",
    new ExactHederaScheme()
  );

  return paymentMiddleware(x402Routes, x402Server);
}
