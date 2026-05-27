import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

const ConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  TLC_BINARY_PATH: z.string().default("/usr/local/bin/tlc"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Config = z.infer<typeof ConfigSchema>;

let config: Config;

export function loadConfig(): Config {
  if (config) return config;

  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error("FATAL: Invalid configuration:", JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  config = result.data;
  return config;
}
