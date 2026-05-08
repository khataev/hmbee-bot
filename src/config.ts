import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { validateTochkaEnv } from './env.js';

const AppConfigSchema = z.object({
  sources: z.object({
    tochka: z.object({})
  })
});

export type AppConfig = {
  sources: {
    tochka: {
      customerId: string;
    };
  };
};

const CONFIG_PATH = resolve(process.cwd(), 'config', 'sources.json');

export function loadConfig(): AppConfig {
  const fileContents = readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(fileContents) as unknown;
  AppConfigSchema.parse(parsed);

  const tochkaEnv = validateTochkaEnv();

  return {
    sources: {
      tochka: {
        customerId: tochkaEnv.TOCHKA_CUSTOMER_ID
      }
    }
  };
}
