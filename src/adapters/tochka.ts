import { z } from 'zod';
import { loadConfig } from '../config.js';
import type { SourceAdapter, SyncOptions, SyncResult } from './types.js';

const TochkaTimelineResponseSchema = z.object({
  result: z
    .object({
      time_line_list: z.array(z.unknown()).default([]),
    })
    .optional(),
});

export class TochkaAdapter implements SourceAdapter {
  name = 'tochka';

  async sync(options: SyncOptions): Promise<SyncResult> {
    const cookie = process.env.TOCHKA_COOKIE;
    if (!cookie) {
      throw new Error('TOCHKA_COOKIE is required');
    }

    // Extract CSRF token from cookie (X-CSRF-TOKEN=...)
    const csrfMatch = cookie.match(/X-CSRF-TOKEN=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : null;

    if (!csrfToken) {
      throw new Error('X-CSRF-TOKEN not found in TOCHKA_COOKIE');
    }

    const config = loadConfig();
    const tochkaConfig = config.sources.tochka;

    // Construct the request based on example-data/tochka/timeline.fetch.txt
    // Note: We use a simplified set of headers based on what's likely required for session auth
    const response = await fetch('https://i.tochka.com/api/v1/timeline', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie,
        'x-csrf-token': csrfToken,
        'x-rpc-method': 'timeline_get_list',
        referer: 'https://i.tochka.com/bank/',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        id: Math.random().toString(36).substring(7),
        jsonrpc: '2.0',
        method: 'timeline_get_list',
        params: {
          customer_id: tochkaConfig.customerId,
          filters: [
            {
              types: [
                { service: 'rs', type: 'PaymentIncome' },
                { service: 'rs', type: 'PaymentWrittenOff' },
              ],
              accounts: [],
              cards: [],
            },
          ],
          start_date: options.from.includes('T') ? options.from : `${options.from}T00:00:00.000Z`,
          end_date: options.to.includes('T') ? options.to : `${options.to}T23:59:59.999Z`,
          page_count: 50,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Tochka synchronization failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as unknown;
    const parsed = TochkaTimelineResponseSchema.parse(data);
    const records = parsed.result?.time_line_list ?? [];

    return {
      source: this.name,
      records,
      raw: data,
    };
  }
}
