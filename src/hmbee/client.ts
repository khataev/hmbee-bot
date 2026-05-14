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

    const payload = HoneyMoneyCreateTransactionResponseSchema.parse((await response.json()) as unknown);

    if (payload.status !== 'success') {
      throw new Error(`Honey Money transaction creation returned status ${payload.status}`);
    }

    return payload.data.transaction.id;
  }
}
