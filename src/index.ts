import { serve } from "@hono/node-server";
import { app } from "./server/app.js";
import { config } from "./config.js";

console.log(`Starting HCS Archive server on port ${config.port}...`);
console.log(`Network: ${config.hederaNetwork}`);
console.log(`Pay to: ${config.payToAccount}`);

serve({
  fetch: app.fetch,
  port: config.port,
});

console.log(`Server running at http://localhost:${config.port}`);
