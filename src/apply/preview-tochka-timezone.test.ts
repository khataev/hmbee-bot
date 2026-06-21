import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('toDateInTimezone via normalizeTochkaRecord', () => {
  const accountMappings = { '40802810309500012345': 67890 };

  const options = {
    accountMappings,
    categoryMapping: {
      mcc: {},
      title: [{ pattern: /.*/, entry: { category: 'Прочее' } }],
      ignored: { mcc: [], title: [] }
    },
    accountRegistry: createAccountRegistry({
      time_zone: 'Europe/Moscow',
      hmbee: { currenciesMapping: {}, categoryMapping: { mcc: {}, title: [], ignored: { mcc: [], title: [] } } },
      sources: {
        tochka: { bankBic: '044525104', accountMappings, hmAccounts: {}, typeCodes: {} }
      },
      allAccountMappings: accountMappings
    } as AppConfig),
    typeCodeRules: {
      CardTransactionInfo: {
        conditions: {
          included: {
            and: [
              { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
              { '==': [{ var: 'record.data.status' }, 'InProgress'] }
            ]
          },
          excluded: { or: [] }
        }
      }
    },
    timeZone: 'Europe/Moscow'
  };

  const makeRecord = (event_date: string): TochkaSyncRecord =>
    ({
      meta_data: {
        system_data: { type_code: 'CardTransactionInfo' },
        time_data: { event_date }
      },
      data: {
        tranId: 1,
        account: '40802810309500012345',
        currency: 'RUB',
        sum: 100,
        tranCode: 'Purchase',
        status: 'InProgress',
        title: 'Test',
        mcc: '0000'
      }
    }) as unknown as TochkaSyncRecord;

  it('transaction at 00:30 UTC+5 resolves to previous day in Europe/Moscow', () => {
    // 2024-03-15T00:30:00+05:00 = 2024-03-14T19:30:00Z = 2024-03-14T22:30:00 Moscow
    const result = normalizeTochkaRecord(makeRecord('2024-03-15T00:30:00+05:00'), options);

    expect(result.normalized?.date).toBe('2024-03-14T22:30:00.000+03:00');
  });

  it('transaction at 12:00 UTC+5 keeps same date in Europe/Moscow', () => {
    // 2024-03-15T12:00:00+05:00 = 2024-03-15T07:00:00Z = 2024-03-15T10:00:00 Moscow
    const result = normalizeTochkaRecord(makeRecord('2024-03-15T12:00:00+05:00'), options);

    expect(result.normalized?.date).toBe('2024-03-15T10:00:00.000+03:00');
  });
});
