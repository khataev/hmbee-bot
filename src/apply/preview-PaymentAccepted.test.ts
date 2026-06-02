import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('PaymentAccepted classification', () => {
  const accountMappings = {
    '40802810100000000001': 2053036,
    '40802810100000000002': 2053036
  };

  const options = {
    accountMappings,
    accountRegistry: createAccountRegistry({
      hmbee: {
        currenciesMapping: {}
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
      PaymentAccepted: {
        conditions: {
          included: {
            or: [
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
              },
              {
                and: [
                  { '==': [{ var: 'record.data.incoming' }, false] },
                  { '==': [{ var: 'record.data.isComission' }, false] },
                  { '==': [{ var: 'record.data.isGovernment' }, true] },
                  {
                    is_owned: [
                      { var: 'record.data.payerAccountId' },
                      { var: 'record.data.payerBankBic' },
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

  it('classifies PaymentAccepted internal transfer as save-ready canonical transfer', () => {
    const fixture = loadFixture('payment-accepted-internal-transfer.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.type).toBe('transfer');
    expect(result.normalized?.counterpartyAccountId).toBe('40802810100000000002');
    expect(result.hmbee?.subtype).toBe('t');
    expect(result.hmbee?.account_id).toBe(2053036);
    if (result.hmbee?.subtype === 't') {
      expect(result.hmbee.transfer_from_id).toBe(2053036);
      expect(result.hmbee.transfer_to_id).toBe(2053036);
      expect(result.hmbee.real_amount).toBeGreaterThan(0);
    }
  });

  it('classifies PaymentAccepted government tax payment as save-ready expense', () => {
    const fixture = loadFixture('payment-accepted-tax.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.type).toBe('Expense');
    expect(result.hmbee?.subtype).toBe('e');
    expect(result.hmbee?.real_amount).toBe(-20154);
    expect(result.hmbee?.account_id).toBe(2053036);
  });
});
