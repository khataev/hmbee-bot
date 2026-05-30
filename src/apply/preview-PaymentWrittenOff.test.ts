import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('PaymentWrittenOff classification', () => {
  const accountMappings = {
    '40802810000000000011': 2053036,
    '42109810000000000033': 26755,
    '40802810901500303852': 2053036,
    '40802810100000000002': 2053036,
    '40802810100000000001': 2053036
  };

  const options = {
    accountMappings,
    accountRegistry: createAccountRegistry({
      sources: {
        tochka: {
          accountMappings,
          hmAccounts: {},
          typeCodes: {}
        }
      }
    } as AppConfig),
    typeCodeRules: {
      PaymentWrittenOff: {
        conditions: {
          included: {
            or: [
              {
                and: [
                  { '==': [{ var: 'record.data.incoming' }, false] },
                  { '==': [{ var: 'record.data.objectState' }, 'Processed'] },
                  { '==': [{ var: 'record.data.failed' }, false] },
                  { '==': [{ var: 'record.data.isComission' }, true] }
                ]
              },
              {
                and: [
                  { '==': [{ var: 'record.data.incoming' }, false] },
                  { '==': [{ var: 'record.data.isComission' }, false] },
                  {
                    is_owned: [
                      { var: 'record.data.payerAccountId' },
                      { var: 'record.data.payerBankBic' },
                      { var: 'accountRegistry' }
                    ]
                  },
                  {
                    is_owned: [
                      { var: 'record.data.payeeAccountId' },
                      { var: 'record.data.payeeBankBic' },
                      { var: 'accountRegistry' }
                    ]
                  }
                ]
              }
            ]
          },
          excluded: { or: [] }
        }
      }
    }
  };

  it('classifies PaymentWrittenOff commission as save-ready expense', () => {
    const fixture = loadFixture('payment-written-off-commission.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.hmbee?.subtype).toBe('e');
    expect(result.hmbee?.real_amount).toBe(-100);
  });
});
