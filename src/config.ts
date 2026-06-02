import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const HoneyMoneyAccountSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  currency: z.string().min(1),
  isDeposit: z.boolean().optional()
});

const JsonLogicRuleSchema = z.record(z.string(), z.any());

const TypeCodeConditionsSchema = z.object({
  included: JsonLogicRuleSchema,
  excluded: JsonLogicRuleSchema
});

const TypeCodeRuleSchema = z.object({
  conditions: TypeCodeConditionsSchema
});

const TochkaConfigSchema = z.object({
  bankBic: z.string(),
  hmAccounts: z.record(z.string(), HoneyMoneyAccountSchema).default({}),
  accountMappings: z.record(z.string(), z.string()).default({}),
  typeCodes: z.record(z.string(), TypeCodeRuleSchema).default({})
});

const HmbeeConfigSchema = z.object({
  currenciesMapping: z.record(z.string(), z.string()).default({})
});

const AppConfigSchema = z.object({
  hmbee: HmbeeConfigSchema,
  sources: z.object({
    tochka: TochkaConfigSchema
  })
});

const ResolvedTochkaConfigSchema = z.object({
  bankBic: z.string(),
  hmAccounts: z.record(z.string(), HoneyMoneyAccountSchema),
  accountMappings: z.record(z.string(), z.number().int().positive()),
  typeCodes: z.record(z.string(), TypeCodeRuleSchema)
});

const ResolvedHmbeeConfigSchema = z.object({
  currenciesMapping: z.record(z.string(), z.string())
});

const ResolvedAppConfigSchema = z.object({
  hmbee: ResolvedHmbeeConfigSchema,
  sources: z.object({
    tochka: ResolvedTochkaConfigSchema
  })
});

export type HoneyMoneyAccountConfig = z.infer<typeof HoneyMoneyAccountSchema>;

export type TypeCodeRule = z.infer<typeof TypeCodeRuleSchema>;
export type TypeCodeConditionsConfig = z.infer<typeof TypeCodeConditionsSchema>;
export type AppConfig = z.infer<typeof ResolvedAppConfigSchema>;

export interface AccountRegistry {
  isOwned(account: string, bic?: string): boolean;
  isDeposit(account: string, bic?: string): boolean;
  getHmAccountId(account: string): number | undefined;
}

const CONFIG_PATH = resolve(process.cwd(), 'config', 'sources.json');

export function loadConfig(): AppConfig {
  const fileContents = readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(fileContents) as unknown;
  const config = AppConfigSchema.parse(parsed);
  const hmAccounts = config.sources.tochka.hmAccounts;
  const typeCodes = config.sources.tochka.typeCodes;

  const currenciesByDeposit: Record<string, string[]> = {};
  for (const [key, account] of Object.entries(hmAccounts)) {
    if (account.isDeposit) {
      const currency = account.currency;
      currenciesByDeposit[currency] = (currenciesByDeposit[currency] ?? []).concat(key);
    }
  }

  for (const [currency, keys] of Object.entries(currenciesByDeposit)) {
    if (keys.length > 1) {
      throw new Error(`Duplicate deposit accounts for currency '${currency}': ${keys.join(', ')}`);
    }
  }

  const accountMappings = Object.fromEntries(
    Object.entries(config.sources.tochka.accountMappings).map(([sourceAccount, hmAccountKey]) => {
      const hmAccount = hmAccounts[hmAccountKey];
      if (!hmAccount) {
        throw new Error(`Unknown Tochka hmAccounts key in config/sources.json: ${hmAccountKey}`);
      }

      return [sourceAccount, hmAccount.id];
    })
  );

  const currenciesMapping = config.hmbee?.currenciesMapping || {};

  return ResolvedAppConfigSchema.parse({
    hmbee: {
      currenciesMapping
    },
    sources: {
      tochka: {
        bankBic: config.sources.tochka.bankBic,
        hmAccounts,
        accountMappings,
        typeCodes
      }
    }
  });
}

export function createAccountRegistry(config: AppConfig): AccountRegistry {
  const tochkaMappings = config.sources.tochka.accountMappings;
  const bankBic = config.sources.tochka.bankBic;
  const hmAccounts = config.sources.tochka.hmAccounts;
  const currenciesMapping = config.hmbee.currenciesMapping;

  const depositByCurrency: Record<string, number> = {};
  for (const [_key, account] of Object.entries(hmAccounts)) {
    if (account.isDeposit) {
      depositByCurrency[account.currency] = account.id;
    }
  }

  return {
    isOwned(account: string, bic: string): boolean {
      if (account in tochkaMappings) return true;
      if (this.isDeposit(account, bic)) return true;
      return false;
    },
    isDeposit(account: string, bic: string): boolean {
      return bic === bankBic && account.startsWith('421');
    },
    getHmAccountId(account: string): number | undefined {
      if (account in tochkaMappings) {
        return tochkaMappings[account];
      }

      if (account.startsWith('421')) {
        const isoCode = account.slice(5, 8);
        const hmCurrency = currenciesMapping[isoCode];
        if (hmCurrency) {
          return depositByCurrency[hmCurrency];
        }
      }

      return undefined;
    }
  };
}
