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

const networkMirrorUrls: Record<string, string> = {
  "hedera:testnet": "https://testnet.mirrornode.hedera.com",
  "hedera:mainnet": "https://mainnet.mirrornode.hedera.com",
  testnet: "https://testnet.mirrornode.hedera.com",
  mainnet: "https://mainnet.mirrornode.hedera.com",
};

const hederaNetwork = optional("HEDERA_NETWORK", "hedera:testnet");
const defaultMirrorUrl =
  networkMirrorUrls[hederaNetwork] ?? "https://testnet.mirrornode.hedera.com";

export const config = {
  port: parseInt(optional("PORT", "4021"), 10),
  hederaNetwork,
  payToAccount: required("PAY_TO_ACCOUNT"),
  facilitatorUrl: optional(
    "FACILITATOR_URL",
    "https://api.testnet.blocky402.com"
  ),
  mirrorNodeUrl: optional("MIRROR_NODE_URL", defaultMirrorUrl),
} as const;
