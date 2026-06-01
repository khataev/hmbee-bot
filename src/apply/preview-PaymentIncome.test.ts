import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('PaymentIncome classification', () => {
  const accountMappings = {
    '40802810000000000011': 2053036,
    '40802810901500303852': 2053036,
    '40802810100000000002': 2053036,
    '40802810100000000001': 2053036
  };

  const options = {
    accountMappings,
    accountRegistry: createAccountRegistry({
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
      PaymentIncome: {
        conditions: {
          included: {
            or: [
              // Row 49: deposit principal return — payer is deposit-like (421*), becomes transfer
              {
                and: [
                  { '==': [{ var: 'record.data.incoming' }, true] },
                  { '==': [{ var: 'record.data.isComission' }, false] },
                  {
                    is_owned: [
                      { var: 'record.data.payeeAccountId' },
                      { var: 'record.data.payeeBankBic' },
                      { var: 'accountRegistry' }
                    ]
                  },
                  {
                    is_deposit: [
                      { var: 'record.data.payerAccountId' },
                      { var: 'record.data.payerBankBic' },
                      { var: 'accountRegistry' }
                    ]
                  }
                ]
              },
              // Row 50: deposit interest — payer is Tochka bank account, not owned, not deposit-like
              {
                and: [
                  { '==': [{ var: 'record.data.incoming' }, true] },
                  { '==': [{ var: 'record.data.isComission' }, false] },
                  {
                    is_owned: [
                      { var: 'record.data.payeeAccountId' },
                      { var: 'record.data.payeeBankBic' },
                      { var: 'accountRegistry' }
                    ]
                  },
                  {
                    '!': {
                      is_owned: [
                        { var: 'record.data.payerAccountId' },
                        { var: 'record.data.payerBankBic' },
                        { var: 'accountRegistry' }
                      ]
                    }
                  },
                  { '==': [{ var: 'record.data.payerBankBic' }, '044525104'] }
                ]
              },
              // Row 51: external incoming payment — payer is at a different bank
              {
                and: [
                  { '==': [{ var: 'record.data.incoming' }, true] },
                  { '==': [{ var: 'record.data.isComission' }, false] },
                  {
                    is_owned: [
                      { var: 'record.data.payeeAccountId' },
                      { var: 'record.data.payeeBankBic' },
                      { var: 'accountRegistry' }
                    ]
                  },
                  {
                    '!': {
                      is_owned: [
                        { var: 'record.data.payerAccountId' },
                        { var: 'record.data.payerBankBic' },
                        { var: 'accountRegistry' }
                      ]
                    }
                  },
                  { '!': { '==': [{ var: 'record.data.payerBankBic' }, '044525104'] } }
                ]
              }
            ]
          },
          excluded: {
            and: [
              { '==': [{ var: 'record.data.incoming' }, true] },
              {
                is_owned: [
                  { var: 'record.data.payerAccountId' },
                  { var: 'record.data.payerBankBic' },
                  { var: 'accountRegistry' }
                ]
              },
              {
                '!': {
                  is_deposit: [
                    { var: 'record.data.payerAccountId' },
                    { var: 'record.data.payerBankBic' },
                    { var: 'accountRegistry' }
                  ]
                }
              }
            ]
          }
        }
      }
    }
  };

  it('marks mirrored PaymentIncome as identified but excluded transfer', () => {
    const fixture = loadFixture('payment-income-mirrored.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('excluded');
    expect(result.normalized?.type).toBe('transfer');
    expect(result.normalized?.counterpartyAccountId).toBe('40802810100000000001');
  });

  it('classifies deposit principal return as save-ready canonical transfer', () => {
    const fixture = loadFixture('payment-income-deposit-return.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.type).toBe('transfer');
    expect(result.normalized?.counterpartyAccountId).toBe('42109810000000000033');
    expect(result.hmbee?.subtype).toBe('i');
    expect(result.hmbee?.real_amount).toBe(173000);
  });

  it('classifies deposit interest as save-ready ordinary income', () => {
    const fixture = loadFixture('payment-income-deposit-interest.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.type).toBe('Income');
    expect(result.hmbee?.subtype).toBe('i');
    expect(result.hmbee?.real_amount).toBe(1507);
  });

  it('classifies external incoming payment as save-ready ordinary income', () => {
    const fixture = loadFixture('payment-income-external.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.type).toBe('Income');
    expect(result.hmbee?.subtype).toBe('i');
    expect(result.hmbee?.real_amount).toBe(1391100);
  });
});
