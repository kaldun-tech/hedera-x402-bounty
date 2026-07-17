import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { MirrorClient, MirrorNodeError } from "../mirror/index.js";
import {
  computeActivityMetric,
  computeDistributionMetric,
  computePortfolioMetric,
  TokenNotFoundError,
  AccountNotFoundError,
} from "../metrics/index.js";
import { config } from "../config.js";
import { createPaymentMiddleware } from "./x402.js";

const app = new Hono();

// Initialize mirror client
const mirrorClient = new MirrorClient({
  baseUrl: config.mirrorNodeUrl,
});

// Data product catalog with prices in tinybars
const CATALOG = {
  "account-activity": {
    name: "Account Activity",
    description:
      "Transaction count, HBAR volume, counterparties, and activity score",
    endpoint: "/metrics/account/:id/activity",
    price: 2_000_000, // 0.02 HBAR
    priceHbar: 0.02,
    params: { days: "number (1-90, default 30)" },
  },
  "token-distribution": {
    name: "Token Distribution",
    description: "Holder concentration metrics including Gini coefficient",
    endpoint: "/metrics/token/:id/distribution",
    price: 5_000_000, // 0.05 HBAR
    priceHbar: 0.05,
    params: {},
  },
  "portfolio-snapshot": {
    name: "Portfolio Snapshot",
    description: "All token balances, NFTs, and HBAR with values",
    endpoint: "/metrics/account/:id/portfolio",
    price: 3_000_000, // 0.03 HBAR
    priceHbar: 0.03,
    params: {},
  },
} as const;

// Middleware
app.use("*", logger());
app.use("*", cors());

// x402 payment middleware - protects /metrics/* routes
app.use("/metrics/*", createPaymentMiddleware());

// Health check
app.get("/health", async (c) => {
  // Simple health check - verify mirror node is reachable
  try {
    // Quick check using a known account
    await mirrorClient.getAccount("0.0.2");
    return c.json({ status: "ok", mirrorNode: config.mirrorNodeUrl });
  } catch {
    return c.json(
      { status: "degraded", mirrorNode: config.mirrorNodeUrl },
      503
    );
  }
});

// Catalog - list available data products
app.get("/catalog", (c) => {
  return c.json({
    products: CATALOG,
    payTo: config.payToAccount,
    network: config.hederaNetwork,
  });
});

// Helper to validate Hedera ID format
function isValidHederaId(id: string): boolean {
  return /^0\.0\.\d+$/.test(id);
}

// Account Activity Metric
app.get("/metrics/account/:id/activity", async (c) => {
  const accountId = c.req.param("id");

  if (!isValidHederaId(accountId)) {
    return c.json({ error: "Invalid account ID format. Expected 0.0.xxxxx" }, 400);
  }

  const daysParam = c.req.query("days");
  const days = daysParam ? parseInt(daysParam, 10) : undefined;

  if (daysParam && (isNaN(days!) || days! < 1 || days! > 90)) {
    return c.json({ error: "days must be between 1 and 90" }, 400);
  }

  try {
    const result = await computeActivityMetric(mirrorClient, {
      accountId,
      days,
    });

    return c.json({
      product: "account-activity",
      price: CATALOG["account-activity"].priceHbar,
      data: result,
    });
  } catch (error) {
    if (error instanceof MirrorNodeError) {
      if (error.status === 404) {
        return c.json({ error: "Account not found" }, 404);
      }
      return c.json({ error: "Mirror node error", details: error.message }, 502);
    }
    throw error;
  }
});

// Token Distribution Metric
app.get("/metrics/token/:id/distribution", async (c) => {
  const tokenId = c.req.param("id");

  if (!isValidHederaId(tokenId)) {
    return c.json({ error: "Invalid token ID format. Expected 0.0.xxxxx" }, 400);
  }

  try {
    const result = await computeDistributionMetric(mirrorClient, { tokenId });

    return c.json({
      product: "token-distribution",
      price: CATALOG["token-distribution"].priceHbar,
      data: result,
    });
  } catch (error) {
    if (error instanceof TokenNotFoundError) {
      return c.json({ error: "Token not found" }, 404);
    }
    if (error instanceof MirrorNodeError) {
      return c.json({ error: "Mirror node error", details: error.message }, 502);
    }
    throw error;
  }
});

// Portfolio Snapshot Metric
app.get("/metrics/account/:id/portfolio", async (c) => {
  const accountId = c.req.param("id");

  if (!isValidHederaId(accountId)) {
    return c.json({ error: "Invalid account ID format. Expected 0.0.xxxxx" }, 400);
  }

  try {
    const result = await computePortfolioMetric(mirrorClient, { accountId });

    return c.json({
      product: "portfolio-snapshot",
      price: CATALOG["portfolio-snapshot"].priceHbar,
      data: result,
    });
  } catch (error) {
    if (error instanceof AccountNotFoundError) {
      return c.json({ error: "Account not found" }, 404);
    }
    if (error instanceof MirrorNodeError) {
      return c.json({ error: "Mirror node error", details: error.message }, 502);
    }
    throw error;
  }
});

export { app, CATALOG };
