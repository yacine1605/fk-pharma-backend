import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import postgres from "postgres";

config({ path: ".env" }); // or .env.local
const client = postgres(process.env.DATABASE_URL!, {
  idle_timeout: 20, // close idle connections after 20s
  max_lifetime: 1800, // recycle connections every 30min
  connect_timeout: 10,
  max: 10, // pool size
});
export const db = drizzle(client, { schema });
