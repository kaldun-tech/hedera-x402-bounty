import postgres from "postgres";
import { config } from "../config.js";

export const sql = postgres(config.databaseUrl);

export async function healthCheck(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
