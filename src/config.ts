import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const HoneyMoneyAccountSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  currency: z.string().min(1)
});

const TochkaConfigSchema = z.object({
  hmAccounts: z.record(z.string(), HoneyMoneyAccountSchema).default({}),
  accountMappings: z.record(z.string(), z.string()).default({})
});

const AppConfigSchema = z.object({
  sources: z.object({
    tochka: TochkaConfigSchema
  })
});

export interface HoneyMoneyAccountConfig {
  id: number;
  name: string;
  currency: string;
}

export type AppConfig = {
  sources: {
    tochka: {
      hmAccounts: Record<string, HoneyMoneyAccountConfig>;
      accountMappings: Record<string, number>;
    };
  };
};

const CONFIG_PATH = resolve(process.cwd(), 'config', 'sources.json');

export function loadConfig(): AppConfig {
  const fileContents = readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(fileContents) as unknown;
  const config = AppConfigSchema.parse(parsed);
  const hmAccounts = config.sources.tochka.hmAccounts;
  const accountMappings = Object.fromEntries(
    Object.entries(config.sources.tochka.accountMappings).map(([sourceAccount, hmAccountKey]) => {
      const hmAccount = hmAccounts[hmAccountKey];
      if (!hmAccount) {
        throw new Error(`Unknown Tochka hmAccounts key in config/sources.json: ${hmAccountKey}`);
      }

      return [sourceAccount, hmAccount.id];
    })
  );

  return {
    sources: {
      tochka: {
        hmAccounts,
        accountMappings
      }
    }
  };
}
