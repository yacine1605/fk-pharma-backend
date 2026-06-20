import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT ?? 5000),
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  UPLOADS_DIR: process.env.UPLOADS_DIR ?? "uploads",
  TEMP_DIR: process.env.TEMP_DIR ?? "temp",
  AI_PROVIDER: process.env.AI_PROVIDER ?? "none",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
} as const;
