import type { ReadyApplyRecord } from 'src/apply/index.js';
import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('VedPaymentIncome classification', () => {
  const accountMappings = {
    '40802810100000000001': 2053036
  };

  const options = {
    accountMappings,
    categoryMapping: { mcc: {}, title: {} },
    accountRegistry: createAccountRegistry({
      hmbee: {
        currenciesMapping: {},
        categoryMapping: { mcc: {}, title: {} }
      },
      sources: {
        tochka: {
          bankBic: '044525104',
          accountMappings,
          hmAccounts: {},
          typeCodes: {}
        }
      }
    } as AppConfig),
    typeCodeRules: {
      VedPaymentIncome: {
        conditions: {
          included: {
            and: [
              { '==': [{ var: 'record.data.state' }, 'UNDISTRIBUTED'] },
              {
                is_owned: [{ var: 'record.data.recipientAccountId' }, null, { var: 'accountRegistry' }]
              }
            ]
          },
          excluded: { or: [] }
        }
      }
    }
  };

  it('classifies VedPaymentIncome (UNDISTRIBUTED) as save-ready income', () => {
    const fixture = loadFixture('ved-payment-income-undistributed.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('income');
    expect(result.hmbee.account_id).toBe(2053036);
    expect(result.hmbee.subtype).toBe('i');
    expect(result.hmbee.currency).toBe('rub');
    expect(result.hmbee.real_amount).toBe(498672);
  });

  it('remains unmatched for non-undistributed VedPaymentIncome states', () => {
    const fixture = loadFixture('ved-payment-income-processing.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(false);
    expect(result.reason).toBe('no matching included/excluded condition');
  });
});
