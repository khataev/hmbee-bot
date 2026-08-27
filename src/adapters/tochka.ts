import { randomUUID } from 'node:crypto';
import type { SourceAdapter, SyncOptions, SyncResult } from 'src/adapters/types.js';
import { getDayBoundsInTimezone } from 'src/apply/preview/tochka.js';
import { credentialProvider } from 'src/credentials/credentialProvider.js';
import { validateTochkaEnv } from 'src/env.js';
import { z } from 'zod';

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

const TochkaTransactionSchema = z.object({
  meta_data: z.object({
    system_data: z.object({
      document_code: z.string(),
      service_code: z.string(),
      service_type_code: z.string(),
      type_code: z.string()
    }),
    time_data: z.object({
      event_date: z.string()
    })
  }),
  data: z
    .object({
      title: z.string().optional().default('No title'),
      sum: z.union([z.number(), z.string().transform((val) => Number(val.replace(/\s/g, '')))]),
      currency: z.string().optional(),
      sumCurrency: z.string().optional(),
      description: z.string().optional(),
      incoming: z.boolean().optional(),
      statusLabel: z.string().optional() // Derived or present in some variants
    })
    .passthrough()
    .transform((data) => ({
      ...data,
      currency: data.currency ?? data.sumCurrency ?? 'RUB'
    }))
});

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
const TOCHKA_PAGE_SIZE = Number(process.env.TOCHKA_PAGE_SIZE) || 250;
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
    const { TOCHKA_CUSTOMER_ID: customerId } = validateTochkaEnv();
    const cookie = credentialProvider.getSession('tochka');

    const cookies = parseCookies(cookie);
    const csrfToken = cookies['X-CSRF-TOKEN'];

    if (!csrfToken) {
      throw new TochkaError(
        'X-CSRF-TOKEN not found in credentials from the provider. Ensure Firefox is open with an active Tochka session, or that TOCHKA_COOKIE is complete.',
        'authentication'
      );
    }

    const allRecords: z.infer<typeof TochkaTransactionSchema>[] = [];
    let rawData: unknown = null;

    // First request: always without lastDate
    const firstPage = await this.fetchPage(customerId, options, cookie, csrfToken);
    allRecords.push(...firstPage.records);
    rawData = firstPage.raw;

    // Subsequent requests: only if first page was full
    // Using >= to be safe in case API returns more than requested (rare but possible)
    if (firstPage.records.length >= TOCHKA_PAGE_SIZE) {
      const lastRec = firstPage.records[firstPage.records.length - 1];
      if (lastRec) {
        let lastDate = lastRec.meta_data.time_data.event_date;

        while (true) {
          const { records, raw } = await this.fetchPage(customerId, options, cookie, csrfToken, lastDate);
          allRecords.push(...records);
          rawData = raw;

          if (records.length < TOCHKA_PAGE_SIZE) {
            break;
          }

          const lastRecord = records[records.length - 1];
          if (!lastRecord) {
            break;
          }
          lastDate = lastRecord.meta_data.time_data.event_date;

          // Safety break
          if (allRecords.length >= TOCHKA_PAGE_SIZE * 100) {
            break;
          }
        }
      }
    }

    return {
      source: this.name,
      records: allRecords,
      raw: rawData
    };
  }

  private async fetchPage(
    customerId: string,
    options: SyncOptions,
    cookie: string,
    csrfToken: string,
    lastDate?: string
  ): Promise<{ records: z.infer<typeof TochkaTransactionSchema>[]; raw: unknown }> {
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
            customer_id: customerId,
            filters: [
              {
                types: [
                  { service: 'billing', type: 'servicePayment' },
                  { service: 'billing', type: 'BillingMobileAccepted' },
                  { service: 'billing', type: 'BillingMobileRejected' },
                  { service: 'billing', type: 'BillingMobileProcessed' },
                  { service: 'cnv', type: 'CurrencyConversionOutgoing' },
                  { service: 'cnv', type: 'CurrencyConversionIncoming' },
                  { service: 'sbp', type: 'SbpPayment' },
                  { service: 'nspk-sbp-core-c2b', type: 'SbpC2CPayment' },
                  { service: 'nspk-sbp-core-c2b', type: 'SbpC2BPayment' },
                  { service: 'nspk-sbp-core-c2b', type: 'SbpC2BRefund' },
                  { service: 'nspk-sbp-core-c2b', type: 'SbpC2BCashbackRefundPayment' },
                  { service: 'nspk-sbp-core-c2b', type: 'SbpB2BPayment' },
                  { service: 'nspk-sbp-core-c2b', type: 'SbpB2CPayment' },
                  { service: 'nspk-sbp-core-c2b', type: 'SbpB2CCashbackPayment' },
                  { service: 'nspk-sbp-core-c2b', type: 'SbpC2CINTPayment' },
                  { service: 'nspk-sbp-core-c2b', type: 'SbpC2GOUTPayment' },
                  { service: 'nspk-sbp-core-c2b', type: 'SbpDisputePayment' },
                  { service: 'sam', type: 'CardTransactionInfo' },
                  { service: 'rs', type: 'PaymentClaim' },
                  { service: 'rs', type: 'PaymentIncome' },
                  { service: 'rs', type: 'PaymentWrittenOff' },
                  { service: 'rs', type: 'CardTransactionWithdraw' },
                  { service: 'rs', type: 'CardTransactionIncome' },
                  { service: 'rs', type: 'CardTransactionRejected' },
                  { service: 'rs', type: 'CardTransactionCancelled' },
                  { service: 'rs', type: 'PaymentRegistry' },
                  { service: 'rs', type: 'PaymentAccepted' },
                  { service: 'rs', type: 'PaymentRejected' },
                  { service: 'rs', type: 'PaymentValidated' },
                  { service: 'rs', type: 'CurrencyPaymentIncome' },
                  { service: 'noah', type: 'ReturnCurrencyIncome' },
                  { service: 'noah', type: 'CurrencyPaymentValidated' },
                  { service: 'noah', type: 'CurrencyPaymentAccepted' },
                  { service: 'noah', type: 'CurrencyPaymentIncome' },
                  { service: 'card-payment', type: 'paymentToCard' },
                  { service: 'acquiring', type: 'CashboxOrderPaid' },
                  { service: 'arrival', type: 'CurrencyIncome' },
                  { service: 'arrival', type: 'VedPaymentIncome' },
                  { service: 'special-account', type: 'SpecialAccountPayment' }

                  // Other possible types to consider in the future:
                  // { service: 'etp-gateway', type: 'SpecialAccountHoldCancelled' },
                  // { service: 'etp-gateway', type: 'SpecialAccountHoldCreated' },
                  // { service: 'special-account', type: 'SpecialAccountHoldCancelled' },
                  // { service: 'special-account', type: 'SpecialAccountHoldCreated' },
                  // { service: 'salary', type: 'PayRollValidated' },
                  // { service: 'salary', type: 'PayRollAccepted' },
                  // { service: 'salary', type: 'PayRollRevoked' },
                  // { service: 'salary', type: 'PayRollRejected' },
                  // { service: 'salary', type: 'PayRollProcessed' },
                  // { service: 'edik', type: 'EdoInvoiceCreated' },
                  // { service: 'blocker', type: 'CollectionOrder' },
                  // { service: 'employees', type: 'PaymentTaskPaid' },
                  // { service: 'employees', type: 'PaymentTaskProcessed' },
                  // { service: 'employees', type: 'PaymentTaskRejected' },
                  // { service: 'apparitor', type: 'SignClaim' },
                  // { service: 'arrival', type: 'TransitWithdrawRejected' },
                  // { service: 'arrival', type: 'DocsApproved' },
                  // { service: 'arrival', type: 'DocsRejected' },
                  // { service: 'arrival', type: 'DeadlineExpired' }
                ],
                accounts: [],
                cards: []
              }
            ],
            exclude_tags: ['биллинговый', 'legacy_card', 'legacy_inkass'],
            start_date: options.from.includes('T')
              ? options.from
              : getDayBoundsInTimezone(options.from, options.timeZone).start,
            end_date: options.to.includes('T') ? options.to : getDayBoundsInTimezone(options.to, options.timeZone).end,
            page_count: TOCHKA_PAGE_SIZE,
            last_date: lastDate
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
      throw new TochkaError('Sync failed: Tochka timeline response does not match the expected schema', 'validation', {
        errors: result.error.format()
      });
    }

    const records = result.data.result?.time_line_list ?? [];

    return {
      records,
      raw: data
    };
  }
}
