import type { ReadyApplyRecord } from 'src/apply/index.js';
import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeHoneyMoneyAmount, normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { HoneyMoneyTransferTransaction } from 'src/apply/preview/types.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('CardTransactionInfo classification', () => {
  const accountMappings = { '40802810309500012345': 67890 };

  const categoryMapping = {
    mcc: {
      '5411': { category: 'Покупки / Продукты' },
      '4111': { category: 'Проезд / Общественный транспорт' },
      '5300': { category: 'Покупки / Маркетплейсы' },
      '4121': { category: 'Проезд / Такси' }
    },
    title: [{ pattern: /WHOOSH/i, entry: { category: 'Услуги / Аренда самокатов' } }],
    rules: [],
    ignored: { mcc: [], title: [] }
  };

  const options = {
    accountMappings,
    categoryMapping,
    accountRegistry: createAccountRegistry({
      time_zone: 'Europe/Moscow',
      hmbee: {
        currenciesMapping: {},
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
      CardTransactionInfo: {
        conditions: {
          included: {
            or: [
              {
                and: [
                  { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
                  { '==': [{ var: 'record.data.status' }, 'InProgress'] }
                ]
              },
              {
                and: [
                  { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
                  { '==': [{ var: 'record.data.status' }, 'Withdraw'] }
                ]
              },
              {
                and: [
                  { '==': [{ var: 'record.data.tranCode' }, 'ReverseByCard'] },
                  { '==': [{ var: 'record.data.status' }, 'Received'] }
                ]
              }
            ]
          },
          excluded: {
            or: [
              { '==': [{ var: 'record.data.tranCode' }, 'CheckCard'] },
              {
                and: [
                  { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
                  { '==': [{ var: 'record.data.status' }, 'Canceled'] }
                ]
              },
              {
                and: [
                  { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
                  { '==': [{ var: 'record.data.status' }, 'Rejected'] }
                ]
              }
            ]
          }
        }
      }
    }
  };

  // Cash withdrawal transfers resolve both legs through the account registry: the card account and
  // the synthetic cash-wallet key `cash:rub`. The included rule additionally accepts CashOutAtm + Withdraw.
  const cardHmId = 67890;
  const cashWalletHmId = 5695;
  const cashOutAccountMappings = { '40802810309500012345': cardHmId, 'cash:rub': cashWalletHmId };

  const cashOutOptions = {
    ...options,
    accountMappings: cashOutAccountMappings,
    accountRegistry: createAccountRegistry({
      time_zone: 'Europe/Moscow',
      hmbee: {
        currenciesMapping: {},
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
      allAccountMappings: cashOutAccountMappings
    } as AppConfig),
    typeCodeRules: {
      CardTransactionInfo: {
        conditions: {
          included: {
            or: [
              {
                and: [
                  { '==': [{ var: 'record.data.tranCode' }, 'CashOutAtm'] },
                  { '==': [{ var: 'record.data.status' }, 'Withdraw'] }
                ]
              }
            ]
          },
          excluded: { or: [] }
        }
      }
    }
  };

  const mockBaseRecord = {
    meta_data: {
      system_data: { type_code: 'CardTransactionInfo' },
      time_data: { event_date: '2026-04-27T11:48:03.000+05:00' }
    },
    data: {
      tranId: 4223584703,
      account: '40802810309500012345',
      currency: 'RUB',
      sum: 241.07,
      tranCode: 'Purchase',
      status: 'InProgress',
      title: 'ART-MOSKVA',
      description: '*0114',
      mcc: '1234'
    }
  };

  it('classifies Purchase + Withdraw as save-ready expense', () => {
    const fixture = loadFixture('card-transaction-purchase-withdraw.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.transactionId).toBe('1000000001');
    expect(result.normalized.amount).toBe(199.98);
    expect(result.normalized.status).toBe('Withdraw');
    expect(result.normalized.type).toBe('expense');
    expect(result.hmbee.account_id).toBe(67890);
    expect(result.hmbee.subtype).toBe('e');
    expect(result.hmbee.currency).toBe('rub');
    expect(result.hmbee.real_amount).toBe(-200);
    expect(result.hmbee.category).toBe('Покупки / Продукты');
  });

  it('classifies Purchase + InProgress as save-ready expense', () => {
    const fixture = loadFixture('card-transaction-purchase-inprogress.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.transactionId).toBe('1000000002');
    expect(result.normalized.amount).toBe(83);
    expect(result.normalized.status).toBe('InProgress');
    expect(result.normalized.type).toBe('expense');
    expect(result.hmbee.account_id).toBe(67890);
    expect(result.hmbee.subtype).toBe('e');
    expect(result.hmbee.currency).toBe('rub');
    expect(result.hmbee.real_amount).toBe(-83);
    expect(result.hmbee.category).toBe('Проезд / Общественный транспорт');
  });

  it('classifies ReverseByCard + Received as save-ready income', () => {
    const fixture = loadFixture('card-transaction-reverse.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.transactionId).toBe('1000000003');
    expect(result.normalized.amount).toBe(1014);
    expect(result.normalized.status).toBe('Received');
    expect(result.normalized.type).toBe('income');
    expect(result.hmbee.account_id).toBe(67890);
    expect(result.hmbee.subtype).toBe('i');
    expect(result.hmbee.currency).toBe('rub');
    expect(result.hmbee.real_amount).toBe(1014);
    expect(result.hmbee.category).toBe('Покупки / Маркетплейсы');
  });

  it('classifies CashOutAtm + Withdraw as a save-ready transfer to the cash wallet', () => {
    const fixture = loadFixture('card-transaction-cash-out-atm.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, cashOutOptions) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('transfer');
    expect(result.normalized.counterpartyAccountId).toBe('cash:rub');
  });

  it('builds a Honey Money transfer from the card account to the cash wallet', () => {
    const fixture = loadFixture('card-transaction-cash-out-atm.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, cashOutOptions) as ReadyApplyRecord;
    const hmbee = result.hmbee as HoneyMoneyTransferTransaction;

    expect(hmbee.subtype).toBe('t');
    expect(hmbee.transfer_from_id).toBe(cardHmId);
    expect(hmbee.transfer_to_id).toBe(cashWalletHmId);
    expect(hmbee.real_amount).toBe(9000);
    expect(hmbee.transfer_to_amount).toBe(9000);
    expect(hmbee.category).toBeNull();
  });

  it('does not identify CashOutAtm in a status other than Withdraw', () => {
    const record = {
      meta_data: {
        system_data: { type_code: 'CardTransactionInfo' },
        time_data: { event_date: '2026-07-21T19:46:22.000+05:00' }
      },
      data: {
        tranId: 1000000005,
        account: '40802810309500012345',
        currency: 'RUB',
        sum: 9000,
        tranCode: 'CashOutAtm',
        status: 'InProgress',
        title: 'Снятие наличных в банкомате',
        mcc: '6011'
      }
    };

    const result = normalizeTochkaRecord(record, cashOutOptions);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('no matching included/excluded condition');
  });

  it('does not save CashOutAtm in a currency without a configured wallet', () => {
    const record = {
      meta_data: {
        system_data: { type_code: 'CardTransactionInfo' },
        time_data: { event_date: '2026-07-21T19:46:22.000+05:00' }
      },
      data: {
        tranId: 1000000006,
        account: '40802810309500012345',
        currency: 'USD',
        sum: 100,
        tranCode: 'CashOutAtm',
        status: 'Withdraw',
        title: 'Снятие наличных в банкомате',
        mcc: '6011'
      }
    };

    const result = normalizeTochkaRecord(record, cashOutOptions);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('Unable to resolve destination (to) HM account ID for transfer');
  });

  it('marks CheckCard as identified but excluded', () => {
    const fixture = loadFixture('card-transaction-checkcard.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('excluded');
    expect(result.normalized).toBeDefined();
    expect(result.hmbee).toBeDefined();
  });

  it('marks Purchase + Canceled as identified but excluded', () => {
    const fixture = loadFixture('card-transaction-purchase-canceled.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('excluded');
  });

  it('marks Purchase + Rejected as identified but excluded', () => {
    const fixture = loadFixture('card-transaction-purchase-rejected.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('excluded');
  });

  it('maps Yandex Taxi to Проезд / Такси', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, title: 'Yandex*4121*Taxi', description: undefined, mcc: '4121' }
    };
    const result = normalizeTochkaRecord(record, options);
    expect(result.hmbee?.category).toBe('Проезд / Такси');
  });

  it('maps category based on MCC', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '5411', title: 'Unknown Merchant' }
    };
    const result = normalizeTochkaRecord(record, options);
    expect(result.hmbee?.category).toBe('Покупки / Продукты');
  });

  it('maps category based on merchant title keyword (exact-ish)', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '0000', title: 'WHOOSH' }
    };
    const result = normalizeTochkaRecord(record, options);
    expect(result.hmbee?.category).toBe('Услуги / Аренда самокатов');
  });

  it('maps category based on merchant title keyword (partial match)', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '0000', title: 'CP* WHOOSH.BIKE' }
    };
    const result = normalizeTochkaRecord(record, options);
    expect(result.hmbee?.category).toBe('Услуги / Аренда самокатов');
  });

  it('title pattern wins over MCC when both match', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '5411', title: 'WHOOSH' }
    };
    const result = normalizeTochkaRecord(record, options);
    expect(result.hmbee?.category).toBe('Услуги / Аренда самокатов');
  });

  it('falls back to MCC when no title pattern matches', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '5411', title: 'Unknown Merchant' }
    };
    const result = normalizeTochkaRecord(record, options);
    expect(result.hmbee?.category).toBe('Покупки / Продукты');
  });

  it('returns null category when neither title pattern nor MCC matches', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '9999', title: 'Unknown Merchant' }
    };
    const result = normalizeTochkaRecord(record, options);
    expect(result.hmbee?.category).toBeNull();
  });

  it('does not identify record with no matching include or exclude rule', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Received' }
    };

    const result = normalizeTochkaRecord(record, options);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('no matching included/excluded condition');
    expect(result.normalized).toBeUndefined();
  });

  it('fails identification on included/excluded ambiguity', () => {
    const optionsWithAmbiguity = {
      ...options,
      categoryMapping: { mcc: {}, title: [], rules: [], ignored: { mcc: [], title: [] } },
      typeCodeRules: {
        CardTransactionInfo: {
          conditions: {
            included: { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
            excluded: { '==': [{ var: 'record.data.status' }, 'InProgress'] }
          }
        }
      }
    };

    const result = normalizeTochkaRecord(mockBaseRecord, optionsWithAmbiguity);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('included/excluded ambiguity');
    expect(result.normalized).toBeUndefined();
  });

  it('does not identify unsupported type_code values', () => {
    const record = {
      ...mockBaseRecord,
      meta_data: {
        ...mockBaseRecord.meta_data,
        system_data: { type_code: 'UnknownType' }
      }
    };

    const result = normalizeTochkaRecord(record, options);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('unsupported type_code: UnknownType');
  });

  it('returns identified: false on parsing error', () => {
    const result = normalizeTochkaRecord({ wrong: 'shape' } as unknown as TochkaSyncRecord, options);
    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBeTypeOf('string');
    expect(result.sourceRecord).toEqual({ wrong: 'shape' });
    expect(result.normalized).toBeUndefined();
  });

  it('normalizes outgoing and incoming amounts for Honey Money', () => {
    expect(normalizeHoneyMoneyAmount(241.07, 'e')).toBe(-241);
    expect(normalizeHoneyMoneyAmount(169.99, 'e')).toBe(-170);
    expect(normalizeHoneyMoneyAmount(241.07, 'i')).toBe(241);
  });

  it('generates description with mapping description when present', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '5912' }
    };
    const result = normalizeTochkaRecord(record, {
      ...options,
      categoryMapping: {
        mcc: { '5912': { category: 'Покупки / Аптека и БАДы', description: 'аптека' } },
        title: [],
        rules: []
      }
    });
    expect(result.hmbee?.category).toBe('Покупки / Аптека и БАДы');
    expect(result.hmbee?.description).toBe('241 аптека');
  });

  it('generates amount-only description when mapping entry has no description', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '5912' }
    };
    const result = normalizeTochkaRecord(record, {
      ...options,
      categoryMapping: {
        mcc: { '5912': { category: 'Покупки / Аптека и БАДы' } },
        title: [],
        rules: []
      }
    });
    expect(result.hmbee?.category).toBe('Покупки / Аптека и БАДы');
    expect(result.hmbee?.description).toBe('241');
  });

  it('returns null category and amount-only description when categoryMapping is empty', () => {
    const result = normalizeTochkaRecord(mockBaseRecord, {
      ...options,
      categoryMapping: { mcc: {}, title: [], rules: [] }
    });
    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('Category is missing for income or expense transaction');
    expect(result.hmbee?.category).toBeNull();
    expect(result.hmbee?.description).toBe('241');
  });

  it('downgrades identified expense with missing category: hmbee is still present', () => {
    const result = normalizeTochkaRecord(mockBaseRecord, {
      ...options,
      categoryMapping: { mcc: {}, title: [], rules: [] }
    });
    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('Category is missing for income or expense transaction');
    expect(result.hmbee).toBeDefined();
    expect(result.hmbee?.subtype).toBe('e');
    expect(result.normalized).toBeDefined();
  });
});
