import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
config({ path: ".env" });

export default defineConfig({
  schema: "./backend/src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  },
});
