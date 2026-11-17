import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { authPlugins } from "./auth-plugins";

const schemaOnlyDb = drizzle(async () => {
  throw new Error("The schema-generation database cannot execute queries.");
});

export const auth = betterAuth({
  baseURL: "http://localhost:8787",
  database: drizzleAdapter(schemaOnlyDb, { provider: "sqlite" }),
  rateLimit: { storage: "database" },
  plugins: authPlugins,
});

export default auth;
