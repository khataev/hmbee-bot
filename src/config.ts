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

const BankConfigSchema = z.object({
  bankBic: z.string().optional(),
  hmAccounts: z.record(z.string(), HoneyMoneyAccountSchema).default({}),
  accountMappings: z.record(z.string(), z.string()).default({}),
  typeCodes: z.record(z.string(), TypeCodeRuleSchema).default({})
});

const TochkaBankConfigSchema = BankConfigSchema.extend({
  bankBic: z.string()
});

const MappingEntrySchema = z.object({
  category: z.string(),
  description: z.string().optional()
});

const ignoredMappingSchema = z.object({
  mcc: z.array(z.string()).default([]),
  title: z.array(z.string()).default([])
});

const categoryMappingSchema = z.object({
  mcc: z.record(z.string(), MappingEntrySchema).default({}),
  title: z.record(z.string(), MappingEntrySchema).default({}),
  ignored: ignoredMappingSchema.default({ mcc: [], title: [] })
});

const HmbeeConfigSchema = z.object({
  currenciesMapping: z.record(z.string(), z.string()).default({}),
  categoryMapping: categoryMappingSchema.default({ mcc: {}, title: {}, ignored: { mcc: [], title: [] } })
});

const AppConfigSchema = z.object({
  time_zone: z.string(),
  hmbee: HmbeeConfigSchema,
  sources: z
    .record(z.string(), BankConfigSchema)
    .refine((s) => Object.keys(s).length > 0, { message: 'sources must not be empty' })
});

const ResolvedBankConfigSchema = z.object({
  bankBic: z.string().optional(),
  hmAccounts: z.record(z.string(), HoneyMoneyAccountSchema),
  accountMappings: z.record(z.string(), z.number().int().positive()),
  typeCodes: z.record(z.string(), TypeCodeRuleSchema)
});

const TitlePatternSchema = z.object({
  pattern: z.instanceof(RegExp),
  entry: MappingEntrySchema
});

const ResolvedCategoryMappingSchema = z.object({
  mcc: z.record(z.string(), MappingEntrySchema),
  title: z.array(TitlePatternSchema),
  ignored: ignoredMappingSchema
});

const ResolvedHmbeeConfigSchema = z.object({
  currenciesMapping: z.record(z.string(), z.string()),
  categoryMapping: ResolvedCategoryMappingSchema
});

const ResolvedAppConfigSchema = z.object({
  time_zone: z.string(),
  hmbee: ResolvedHmbeeConfigSchema,
  sources: z.record(z.string(), ResolvedBankConfigSchema),
  allAccountMappings: z.record(z.string(), z.number().int().positive())
});

export type HoneyMoneyAccountConfig = z.infer<typeof HoneyMoneyAccountSchema>;
export type TypeCodeRule = z.infer<typeof TypeCodeRuleSchema>;
export type TypeCodeConditionsConfig = z.infer<typeof TypeCodeConditionsSchema>;
export type MappingEntry = z.infer<typeof MappingEntrySchema>;
export type TitlePattern = z.infer<typeof TitlePatternSchema>;
export type BankConfig = z.infer<typeof BankConfigSchema>;
export type TochkaBankConfig = z.infer<typeof TochkaBankConfigSchema>;
export type AppConfig = z.infer<typeof ResolvedAppConfigSchema>;
export type CategoryMapping = Omit<z.infer<typeof ResolvedCategoryMappingSchema>, 'ignored'>;

export interface AccountRegistry {
  isOwned(account: string, bic: string): boolean;
  isDeposit(account: string, bic: string): boolean;
  getHmAccountId(account: string): number | undefined;
}

const CONFIG_PATH = resolve(process.cwd(), 'config', 'sources.json');

export function loadConfig(): AppConfig {
  const fileContents = readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(fileContents) as unknown;
  const config = AppConfigSchema.parse(parsed);

  // Deposit duplicate check (tochka-specific heuristic)
  const tochkaRaw = config.sources.tochka;
  if (tochkaRaw) {
    const currenciesByDeposit: Record<string, string[]> = {};
    for (const [key, account] of Object.entries(tochkaRaw.hmAccounts)) {
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
  }

  // Build per-bank resolved mappings and unified account map simultaneously
  const allAccountMappings: Record<string, number> = {};
  const resolvedSources: Record<string, z.infer<typeof ResolvedBankConfigSchema>> = {};

  for (const [bankName, bankConfig] of Object.entries(config.sources)) {
    const resolvedMappings: Record<string, number> = {};
    for (const [accountNumber, hmAccountKey] of Object.entries(bankConfig.accountMappings)) {
      const hmAccount = bankConfig.hmAccounts[hmAccountKey];
      if (!hmAccount) {
        throw new Error(`Unknown hmAccounts key '${hmAccountKey}' in sources.${bankName}.accountMappings`);
      }
      const existingId = allAccountMappings[accountNumber];
      if (existingId !== undefined && existingId !== hmAccount.id) {
        throw new Error(
          `Account number '${accountNumber}' is mapped to different Honey Money accounts in different banks`
        );
      }
      allAccountMappings[accountNumber] = hmAccount.id;
      resolvedMappings[accountNumber] = hmAccount.id;
    }
    resolvedSources[bankName] = { ...bankConfig, accountMappings: resolvedMappings };
  }

  const titlePatterns: TitlePattern[] = Object.entries(config.hmbee.categoryMapping.title).map(([pat, entry]) => {
    try {
      return { pattern: new RegExp(pat, 'i'), entry };
    } catch {
      throw new Error(`Invalid regex pattern in categoryMapping.title: "${pat}"`);
    }
  });

  return ResolvedAppConfigSchema.parse({
    time_zone: config.time_zone,
    hmbee: {
      currenciesMapping: config.hmbee.currenciesMapping,
      categoryMapping: {
        mcc: config.hmbee.categoryMapping.mcc,
        title: titlePatterns,
        ignored: config.hmbee.categoryMapping.ignored
      }
    },
    sources: resolvedSources,
    allAccountMappings
  });
}

export function createAccountRegistry(config: AppConfig): AccountRegistry {
  const allMappings = config.allAccountMappings;
  const currenciesMapping = config.hmbee.currenciesMapping;

  // Deposit detection is tochka-specific: BIC 044525104 + account prefix 421
  const tochkaConfig = config.sources.tochka;
  const bankBic = tochkaConfig?.bankBic;
  const hmAccounts = tochkaConfig?.hmAccounts ?? {};

  const depositByCurrency: Record<string, number> = {};
  for (const [_key, account] of Object.entries(hmAccounts)) {
    if (account.isDeposit) {
      depositByCurrency[account.currency] = account.id;
    }
  }

  return {
    isOwned(account: string, bic: string): boolean {
      if (account in allMappings) return true;
      if (this.isDeposit(account, bic)) return true;
      return false;
    },
    isDeposit(account: string, bic: string): boolean {
      return bankBic !== undefined && bic === bankBic && account.startsWith('421');
    },
    getHmAccountId(account: string): number | undefined {
      if (account in allMappings) {
        return allMappings[account];
      }

      if (account.startsWith('421')) {
        // Russian bank accounts encode the ISO 4217 numeric currency code at positions 5–7
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
