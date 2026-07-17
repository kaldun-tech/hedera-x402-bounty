import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const config = {
  port: parseInt(optional("PORT", "4021"), 10),
  hederaNetwork: optional("HEDERA_NETWORK", "hedera:testnet"),
  payToAccount: required("PAY_TO_ACCOUNT"),
  facilitatorUrl: optional("FACILITATOR_URL", "https://api.testnet.blocky402.com"),
  databaseUrl: required("DATABASE_URL"),
} as const;
