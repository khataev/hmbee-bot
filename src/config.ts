import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const HoneyMoneyAccountSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  currency: z.string().min(1)
});

const TypeCodeConditionSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

const TypeCodeConditionsSchema = z.object({
  included: z.array(TypeCodeConditionSchema),
  excluded: z.array(TypeCodeConditionSchema)
});

const TypeCodeRuleSchema = z.object({
  conditions: TypeCodeConditionsSchema
});

const TochkaConfigSchema = z.object({
  hmAccounts: z.record(z.string(), HoneyMoneyAccountSchema).default({}),
  accountMappings: z.record(z.string(), z.string()).default({}),
  typeCodes: z.record(z.string(), TypeCodeRuleSchema).default({})
});

const AppConfigSchema = z.object({
  sources: z.object({
    tochka: TochkaConfigSchema
  })
});

const ResolvedTochkaConfigSchema = z.object({
  hmAccounts: z.record(z.string(), HoneyMoneyAccountSchema),
  accountMappings: z.record(z.string(), z.number().int().positive()),
  typeCodes: z.record(z.string(), TypeCodeRuleSchema)
});

const ResolvedAppConfigSchema = z.object({
  sources: z.object({
    tochka: ResolvedTochkaConfigSchema
  })
});

export type HoneyMoneyAccountConfig = z.infer<typeof HoneyMoneyAccountSchema>;

export type TypeCodeCondition = z.infer<typeof TypeCodeConditionSchema>;
export type TypeCodeRule = z.infer<typeof TypeCodeRuleSchema>;
export type TypeCodeConditionsConfig = z.infer<typeof TypeCodeConditionsSchema>;
export type AppConfig = z.infer<typeof ResolvedAppConfigSchema>;

const CONFIG_PATH = resolve(process.cwd(), 'config', 'sources.json');

export function loadConfig(): AppConfig {
  const fileContents = readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(fileContents) as unknown;
  const config = AppConfigSchema.parse(parsed);
  const hmAccounts = config.sources.tochka.hmAccounts;
  const typeCodes = config.sources.tochka.typeCodes;
  const accountMappings = Object.fromEntries(
    Object.entries(config.sources.tochka.accountMappings).map(([sourceAccount, hmAccountKey]) => {
      const hmAccount = hmAccounts[hmAccountKey];
      if (!hmAccount) {
        throw new Error(`Unknown Tochka hmAccounts key in config/sources.json: ${hmAccountKey}`);
      }

      return [sourceAccount, hmAccount.id];
    })
  );

  return ResolvedAppConfigSchema.parse({
    sources: {
      tochka: {
        hmAccounts,
        accountMappings,
        typeCodes
      }
    }
  });
}
