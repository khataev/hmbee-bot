import type { HoneyMoneyTransaction } from 'src/apply/preview/types.js';
import type { THoneyMoneyEnvSchema } from 'src/env.js';
import { z } from 'zod';

const HoneyMoneyCreateTransactionResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    id: z.number().int().positive(),
    transaction: z.object({
      id: z.number().int().positive()
    })
  })
});

export const HoneyMoneyCacheEntrySchema = z.object({
  id: z.number(),
  type: z.string(),
  subtype: z.string(),
  real_amount: z.number().nullable().optional(),
  plan_amount: z.number().nullable().optional(),
  currency: z.string(),
  description: z.string().optional(),
  date: z.string(),
  category: z.string().nullable().optional(),
  account_id: z.number().optional(),
  common_id: z.union([z.number(), z.string()]).nullable().optional(),
  virtual_id: z.union([z.number(), z.string()]).nullable().optional()
});

export type HoneyMoneyCacheEntry = z.infer<typeof HoneyMoneyCacheEntrySchema>;

const AllJsonResponseSchema = z.array(HoneyMoneyCacheEntrySchema);

export class HoneyMoneyClient {
  constructor(private readonly env: THoneyMoneyEnvSchema) {}

  async createTransaction(transaction: HoneyMoneyTransaction): Promise<number> {
    const response = await fetch(`${this.env.HM_API_BASE_URL.replace(/\/$/, '')}/transaction`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'hm-source': this.env.HM_SOURCE,
        'user-email': this.env.HM_USER_EMAIL,
        'user-token': this.env.HM_USER_TOKEN,
        cookie: this.env.HM_COOKIE
      },
      body: JSON.stringify({ transaction })
    });

    if (!response.ok) {
      throw new Error(`Honey Money request failed with status ${response.status}`);
    }

    const payload = HoneyMoneyCreateTransactionResponseSchema.parse(await response.json());

    if (payload.status !== 'success') {
      throw new Error(`Honey Money transaction creation returned status ${payload.status}`);
    }

    return payload.data.transaction.id;
  }

  async getAllTransactions(): Promise<HoneyMoneyCacheEntry[]> {
    const response = await fetch(`${this.env.HM_API_BASE_URL.replace(/\/$/, '')}/transaction/all_json.json`, {
      headers: {
        'content-type': 'application/json',
        'hm-source': this.env.HM_SOURCE,
        'user-email': this.env.HM_USER_EMAIL,
        'user-token': this.env.HM_USER_TOKEN,
        cookie: this.env.HM_COOKIE
      }
    });

    if (!response.ok) {
      throw new Error(`Honey Money all_json request failed with status ${response.status}`);
    }

    return AllJsonResponseSchema.parse(await response.json());
  }
}
