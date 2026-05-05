import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadConfig } from '../config.js';
import type { SourceAdapter, SyncOptions, SyncResult } from './types.js';

/**
 * Custom error for Tochka adapter failures
 */
export class TochkaError extends Error {
  constructor(
    message: string,
    public readonly category: 'validation' | 'authentication' | 'upstream' | 'parsing',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TochkaError';
  }
}

const TochkaTransactionSchema = z
  .object({
    meta_data: z.object({
      system_data: z.object({
        document_code: z.string()
      }),
      time_data: z.object({
        event_date: z.string()
      })
    }),
    data: z
      .object({
        title: z.string(),
        sum: z.number(),
        currency: z.string(),
        description: z.string().optional(),
        incoming: z.boolean(),
        statusLabel: z.string().optional() // Derived or present in some variants
      })
      .passthrough()
  })
  .passthrough();

const TochkaTimelineResponseSchema = z.object({
  result: z
    .object({
      time_line_list: z.array(TochkaTransactionSchema).default([])
    })
    .optional()
});

// Constants for Tochka API
const TOCHKA_API_URL = 'https://i.tochka.com/api/v1/timeline';
const TOCHKA_RPC_METHOD = 'timeline_get_list';
const TOCHKA_PAGE_SIZE = 50;
const TOCHKA_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';

/**
 * Utility to parse cookies safely
 */
function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieString) return cookies;

  for (const pair of cookieString.split(';')) {
    const [key, ...valueParts] = pair.split('=');
    if (key) {
      cookies[key.trim()] = valueParts.join('=').trim();
    }
  }
  return cookies;
}

export class TochkaAdapter implements SourceAdapter {
  name = 'tochka';

  async sync(options: SyncOptions): Promise<SyncResult> {
    const cookie = process.env.TOCHKA_COOKIE;
    if (!cookie) {
      throw new TochkaError(
        'TOCHKA_COOKIE environment variable is missing. Please add it to your .env file.',
        'validation'
      );
    }

    const cookies = parseCookies(cookie);
    const csrfToken = cookies['X-CSRF-TOKEN'];

    if (!csrfToken) {
      throw new TochkaError(
        'X-CSRF-TOKEN not found in TOCHKA_COOKIE. Ensure your session cookie is complete.',
        'authentication'
      );
    }

    const config = loadConfig();
    const tochkaConfig = config.sources.tochka;

    let response: Response;
    try {
      response = await fetch(TOCHKA_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          'x-csrf-token': csrfToken,
          'x-rpc-method': TOCHKA_RPC_METHOD,
          referer: 'https://i.tochka.com/bank/',
          'user-agent': TOCHKA_USER_AGENT
        },
        body: JSON.stringify({
          id: randomUUID(),
          jsonrpc: '2.0',
          method: TOCHKA_RPC_METHOD,
          params: {
            customer_id: tochkaConfig.customerId,
            filters: [
              {
                types: [
                  { service: 'rs', type: 'PaymentIncome' },
                  { service: 'rs', type: 'PaymentWrittenOff' }
                ],
                accounts: [],
                cards: []
              }
            ],
            start_date: options.from.includes('T') ? options.from : `${options.from}T00:00:00.000Z`,
            end_date: options.to.includes('T') ? options.to : `${options.to}T23:59:59.999Z`,
            page_count: TOCHKA_PAGE_SIZE
          }
        })
      });
    } catch (error) {
      throw new TochkaError(
        `Network error during Tochka synchronization: ${error instanceof Error ? error.message : String(error)}`,
        'upstream',
        { originalError: error }
      );
    }

    if (!response.ok) {
      throw new TochkaError(`Tochka synchronization failed with status ${response.status}`, 'upstream', {
        status: response.status,
        statusText: response.statusText
      });
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new TochkaError('Failed to parse Tochka response as JSON', 'parsing', { originalError: error });
    }

    const result = TochkaTimelineResponseSchema.safeParse(data);
    if (!result.success) {
      throw new TochkaError('Tochka timeline response does not match the expected schema', 'parsing', {
        errors: result.error.format()
      });
    }

    const records = result.data.result?.time_line_list ?? [];

    return {
      source: this.name,
      records,
      raw: data
    };
  }
}
