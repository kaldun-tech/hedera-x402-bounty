import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { healthCheck } from "../db/client.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Health check
app.get("/health", async (c) => {
  const dbHealthy = await healthCheck();
  const status = dbHealthy ? 200 : 503;
  return c.json({ status: dbHealthy ? "ok" : "degraded", db: dbHealthy }, status);
});

// Free endpoints
app.get("/topics", async (c) => {
  // TODO: List indexed topics
  return c.json({ topics: [] });
});

app.get("/topics/:id/recent", async (c) => {
  const topicId = c.req.param("id");
  // TODO: Return last 24h of messages (free)
  return c.json({ topicId, messages: [], note: "Last 24 hours - free" });
});

// Paid endpoints (x402) - to be protected with middleware
app.get("/topics/:id/messages", async (c) => {
  const topicId = c.req.param("id");
  // TODO: Return full archive (paginated) - requires payment
  return c.json({ topicId, messages: [], note: "Full archive - requires x402 payment" });
});

app.get("/topics/:id/search", async (c) => {
  const topicId = c.req.param("id");
  const query = c.req.query("q");
  // TODO: Search messages - requires payment
  return c.json({ topicId, query, results: [], note: "Search - requires x402 payment" });
});

app.get("/topics/:id/export", async (c) => {
  const topicId = c.req.param("id");
  // TODO: Bulk export - higher price tier
  return c.json({ topicId, note: "Bulk export - requires x402 payment (higher tier)" });
});

export { app };
