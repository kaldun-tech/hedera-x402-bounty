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

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

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

// Landing page
app.get("/", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hedera Mirror Node Metrics API</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2rem; background: #0a0a0a; color: #e0e0e0; }
    h1 { color: #fff; border-bottom: 2px solid #8b5cf6; padding-bottom: 0.5rem; }
    h2 { color: #a78bfa; margin-top: 2rem; }
    a { color: #8b5cf6; }
    code { background: #1e1e1e; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    pre { background: #1e1e1e; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #333; }
    th { color: #a78bfa; }
    .price { color: #22c55e; font-weight: bold; }
    .free { color: #3b82f6; }
    .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8em; }
    .badge-free { background: #1e3a5f; color: #60a5fa; }
    .badge-paid { background: #14532d; color: #4ade80; }
    .try-link { font-size: 0.85em; }
    .info { background: #1e1e2e; border-left: 4px solid #8b5cf6; padding: 1rem; margin: 1rem 0; border-radius: 0 8px 8px 0; }
  </style>
</head>
<body>
  <h1>Hedera Mirror Node Metrics API</h1>
  <p>Pay-per-query analytics API for Hedera network data, powered by <a href="https://www.x402.org/">x402</a> micropayments.</p>

  <div class="info">
    <strong>How it works:</strong> Paid endpoints return <code>HTTP 402 Payment Required</code>.
    Your client signs a payment with your Hedera wallet, and the request is retried with the payment header.
    The facilitator settles the transaction on-chain.
  </div>

  <h2>API Endpoints</h2>
  <table>
    <thead>
      <tr><th>Endpoint</th><th>Price</th><th>Description</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><code>GET /health</code></td>
        <td><span class="badge badge-free">Free</span></td>
        <td>Health check <span class="try-link">(<a href="/health">try it</a>)</span></td>
      </tr>
      <tr>
        <td><code>GET /catalog</code></td>
        <td><span class="badge badge-free">Free</span></td>
        <td>List available data products <span class="try-link">(<a href="/catalog">try it</a>)</span></td>
      </tr>
      <tr>
        <td><code>GET /metrics/account/:id/activity</code></td>
        <td><span class="price">0.02 HBAR</span></td>
        <td>Account activity score, tx count, volume, counterparties</td>
      </tr>
      <tr>
        <td><code>GET /metrics/token/:id/distribution</code></td>
        <td><span class="price">0.05 HBAR</span></td>
        <td>Token holder concentration (Gini coefficient)</td>
      </tr>
      <tr>
        <td><code>GET /metrics/account/:id/portfolio</code></td>
        <td><span class="price">0.03 HBAR</span></td>
        <td>Full portfolio snapshot (HBAR, tokens, NFTs)</td>
      </tr>
    </tbody>
  </table>

  <h2>Example Usage</h2>
  <pre><code># Free endpoints
curl ${c.req.url}health
curl ${c.req.url}catalog

# Paid endpoint (returns 402 without payment)
curl -i ${c.req.url}metrics/account/0.0.98/activity</code></pre>

  <h2>Configuration</h2>
  <table>
    <tr><td><strong>Network</strong></td><td><code>${config.hederaNetwork}</code></td></tr>
    <tr><td><strong>Pay To</strong></td><td><code>${config.payToAccount}</code></td></tr>
    <tr><td><strong>Mirror Node</strong></td><td><code>${config.mirrorNodeUrl}</code></td></tr>
  </table>

  <p style="margin-top: 2rem; color: #666; font-size: 0.9em;">
    Built for the Hedera x402 Bounty.
    <a href="https://github.com/kaldun-tech/hedera-x402-bounty">Source on GitHub</a>
  </p>
</body>
</html>`;
  return c.html(html);
});

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

// Helper to validate Hedera ID format (max 10 digits for entity number)
function isValidHederaId(id: string): boolean {
  return /^0\.0\.\d{1,10}$/.test(id);
}

// Account Activity Metric
app.get("/metrics/account/:id/activity", async (c) => {
  const accountId = c.req.param("id");

  if (!isValidHederaId(accountId)) {
    return c.json({ error: "Invalid account ID format. Expected 0.0.xxxxx" }, 400);
  }

  const daysParam = c.req.query("days");
  const days = daysParam ? parseInt(daysParam, 10) : undefined;

  if (days !== undefined && (isNaN(days) || days < 1 || days > 90)) {
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
