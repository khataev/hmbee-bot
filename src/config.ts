import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const AppConfigSchema = z.object({
  sources: z.object({
    tochka: z.object({
      customerId: z.string().min(1, 'config.sources.tochka.customerId is required')
    })
  })
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

const CONFIG_PATH = resolve(process.cwd(), 'config', 'sources.json');

export function loadConfig(): AppConfig {
  const fileContents = readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(fileContents) as unknown;

  return AppConfigSchema.parse(parsed);
}
