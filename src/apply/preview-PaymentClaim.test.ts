import type { ReadyApplyRecord } from 'src/apply/index.js';
import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { PaymentClaimRecord, TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

const PERIODIC_CATEGORY = 'Банки / Периодические списания';

describe('PaymentClaim classification', () => {
  const accountMappings = { '40802810100000000001': 2053036 };

  const options = {
    accountMappings,
    categoryMapping: {
      mcc: {},
      title: [],
      rules: [
        {
          when: {
            and: [
              { '==': [{ var: 'record.meta_data.system_data.type_code' }, 'PaymentClaim'] },
              { matches: ['смс-информирование', { var: 'record.data.purpose' }] }
            ]
          },
          category: PERIODIC_CATEGORY,
          description: 'СМС-информирование'
        },
        {
          when: {
            and: [
              { '==': [{ var: 'record.meta_data.system_data.type_code' }, 'PaymentClaim'] },
              { matches: ['лицензионного вознаграждения', { var: 'record.data.purpose' }] }
            ]
          },
          category: PERIODIC_CATEGORY,
          description: 'Оплата лицензионного вознаграждения'
        }
      ],
      ignored: { mcc: [], title: [] }
    },
    accountRegistry: createAccountRegistry({
      time_zone: 'Europe/Moscow',
      hmbee: {
        currenciesMapping: { '810': 'rub' },
        categoryMapping: { mcc: {}, title: [], rules: [], ignored: { mcc: [], title: [] } }
      },
      sources: {
        tochka: {
          bankBic: '044525104',
          accountMappings,
          hmAccounts: {},
          typeCodes: {}
        }
      },
      allAccountMappings: accountMappings
    } as AppConfig),
    timeZone: 'Europe/Moscow',
    typeCodeRules: {
      PaymentClaim: {
        conditions: {
          included: { '==': [{ var: 'record.data.objectState' }, 'Processed'] },
          excluded: { or: [] }
        }
      }
    }
  };

  it('classifies the СМС-информирование fixture as a save-ready expense', () => {
    const fixture = loadFixture('payment-claim-sms.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('expense');
    expect(result.normalized.description).toContain('смс-информирование');
    expect(result.normalized.counterpartyAccountId).toBeUndefined();
    expect(result.hmbee.category).toBe(PERIODIC_CATEGORY);
    expect(result.hmbee.account_id).toBe(2053036);
    expect(result.hmbee.subtype).toBe('e');
    expect(result.hmbee.real_amount).toBe(-100);
  });

  it('classifies the license fee fixture as a save-ready expense', () => {
    const fixture = loadFixture('payment-claim-license.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('expense');
    expect(result.normalized.description).toContain('лицензионного вознаграждения');
    expect(result.hmbee.category).toBe(PERIODIC_CATEGORY);
    expect(result.hmbee.real_amount).toBe(-950);
  });

  it('does not identify a non-Processed PaymentClaim', () => {
    const base = loadFixture('payment-claim-sms.json') as PaymentClaimRecord;
    const record = { ...base, data: { ...base.data, objectState: 'InProgress' } };

    const result = normalizeTochkaRecord(record, options);

    expect(result.identified).toBe(false);
    expect(result.reason).toBe('no matching included/excluded condition');
  });
});
