import type { ReadyApplyRecord } from 'src/apply/index.js';
import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type {
  CardTransactionInfoRecord,
  PaymentClaimRecord,
  SbpB2CPaymentRecord,
  TochkaSyncRecord
} from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig, RuleEntry } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

const PERIODIC_CATEGORY = 'Банки / Периодические списания';

const smsRule: RuleEntry = {
  when: {
    and: [
      { '==': [{ var: 'record.meta_data.system_data.type_code' }, 'PaymentClaim'] },
      { matches: ['смс-информирование', { var: 'record.data.purpose' }] }
    ]
  },
  category: PERIODIC_CATEGORY,
  description: 'СМС-информирование'
};

const licenseRule: RuleEntry = {
  when: {
    and: [
      { '==': [{ var: 'record.meta_data.system_data.type_code' }, 'PaymentClaim'] },
      { matches: ['лицензионного вознаграждения', { var: 'record.data.purpose' }] }
    ]
  },
  category: PERIODIC_CATEGORY,
  description: 'Оплата лицензионного вознаграждения'
};

describe('categoryMapping.rules — PaymentClaim by purpose', () => {
  const accountMappings = { '40802810309500023530': 2053036 };

  const makeOptions = (rules: RuleEntry[], title: { pattern: RegExp; entry: { category: string } }[] = []) => ({
    accountMappings,
    categoryMapping: { mcc: {}, title, rules, ignored: { mcc: [], title: [] } },
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
      PaymentClaim: {
        conditions: {
          included: { '==': [{ var: 'record.data.objectState' }, 'Processed'] },
          excluded: { or: [] }
        }
      }
    }
  });

  const makeRecord = (purpose: string): TochkaSyncRecord => {
    const base = loadFixture('payment-claim-sms.json') as PaymentClaimRecord;
    return { ...base, data: { ...base.data, purpose } };
  };

  it('maps purpose containing "СМС-информирование" (case-insensitive) to the rule category', () => {
    const record = makeRecord('Плата за СМС-информирование за июнь');

    const result = normalizeTochkaRecord(record, makeOptions([smsRule])) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.hmbee.category).toBe(PERIODIC_CATEGORY);
    expect(result.hmbee.description).toBe('100 СМС-информирование');
  });

  it('maps purpose containing "лицензионного вознаграждения" to the rule category', () => {
    const record = makeRecord('Оплата лицензионного вознаграждения по договору');

    const result = normalizeTochkaRecord(record, makeOptions([smsRule, licenseRule])) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.hmbee.category).toBe(PERIODIC_CATEGORY);
    expect(result.hmbee.description).toBe('100 Оплата лицензионного вознаграждения');
  });

  it('rule wins over a matching title pattern', () => {
    const record = makeRecord('Плата за СМС-информирование за июнь');
    const titleCatchAll = [{ pattern: /.*/, entry: { category: 'Банки' } }];

    const result = normalizeTochkaRecord(record, makeOptions([smsRule], titleCatchAll)) as ReadyApplyRecord;

    expect(result.hmbee.category).toBe(PERIODIC_CATEGORY);
  });

  it('first matching rule wins when several rules match', () => {
    const record = makeRecord('Плата за СМС-информирование за июнь');
    const broadRule: RuleEntry = {
      when: { matches: ['смс', { var: 'record.data.purpose' }] },
      category: 'Прочие'
    };

    const result = normalizeTochkaRecord(record, makeOptions([smsRule, broadRule])) as ReadyApplyRecord;
    expect(result.hmbee.category).toBe(PERIODIC_CATEGORY);

    const swapped = normalizeTochkaRecord(record, makeOptions([broadRule, smsRule])) as ReadyApplyRecord;
    expect(swapped.hmbee.category).toBe('Прочие');
  });

  it('invalid regex in matches does not break resolution and falls back to the next layer', () => {
    const record = makeRecord('Плата за СМС-информирование за июнь');
    const brokenRule: RuleEntry = {
      when: { matches: ['[invalid(', { var: 'record.data.purpose' }] },
      category: 'Не должна примениться'
    };
    const titleCatchAll = [{ pattern: /.*/, entry: { category: 'Прочее' } }];

    const result = normalizeTochkaRecord(record, makeOptions([brokenRule], titleCatchAll)) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.hmbee.category).toBe('Прочее');
  });
});

describe('categoryMapping.rules — SbpB2CPayment by phoneNumber', () => {
  const accountMappings = {
    '40802810100000000001': 2053036,
    '40817810000000000001': 26755
  };

  const phoneRule: RuleEntry = {
    when: { '==': [{ var: 'record.data.phoneNumber' }, '+79000000000'] },
    category: 'Услуги / Психолог',
    description: 'по номеру телефона'
  };

  const options = {
    accountMappings,
    categoryMapping: { mcc: {}, title: [], rules: [phoneRule], ignored: { mcc: [], title: [] } },
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
      SbpB2CPayment: {
        conditions: {
          included: {
            and: [
              { '==': [{ var: 'record.data.status' }, 'ACCEPTED'] },
              { '==': [{ var: 'record.data.incoming' }, false] },
              {
                is_owned: [
                  { var: 'record.data.payerAccountId' },
                  { var: 'record.data.payerBankBic' },
                  { var: 'accountRegistry' }
                ]
              }
            ]
          },
          excluded: { or: [] }
        }
      }
    }
  };

  it('maps SbpB2CPayment with the target phoneNumber to the rule category', () => {
    const fixture = loadFixture('sbp-b2c-payment-non-transfer.json') as SbpB2CPaymentRecord;

    const result = normalizeTochkaRecord(fixture, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.hmbee.category).toBe('Услуги / Психолог');
    expect(result.hmbee.description).toBe('4000 по номеру телефона');
  });

  it('does not apply the rule when phoneNumber differs', () => {
    const base = loadFixture('sbp-b2c-payment-non-transfer.json') as SbpB2CPaymentRecord;
    const record = { ...base, data: { ...base.data, phoneNumber: '+79999999999' } };

    const result = normalizeTochkaRecord(record, options);

    expect(result.hmbee?.category).toBeNull();
  });
});

describe('categoryMapping.rules — CardTransactionInfo by cardPanPart', () => {
  const accountMappings = { '40802810309500012345': 67890 };

  const panRule: RuleEntry = {
    when: { '==': [{ var: 'record.data.cardPanPart' }, '1234'] },
    category: 'Покупки / Карта ребёнка'
  };

  const options = {
    accountMappings,
    categoryMapping: {
      mcc: { '5411': { category: 'Покупки / Продукты' } },
      title: [],
      rules: [panRule],
      ignored: { mcc: [], title: [] }
    },
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
            and: [
              { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
              { '==': [{ var: 'record.data.status' }, 'Withdraw'] }
            ]
          },
          excluded: { or: [] }
        }
      }
    }
  };

  it('maps CardTransactionInfo with the target cardPanPart to the rule category ahead of mcc', () => {
    const base = loadFixture('card-transaction-purchase-withdraw.json') as CardTransactionInfoRecord;
    const record = { ...base, data: { ...base.data, cardPanPart: '1234' } };

    const result = normalizeTochkaRecord(record, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.hmbee.category).toBe('Покупки / Карта ребёнка');
  });

  it('falls back to mcc when cardPanPart differs', () => {
    const base = loadFixture('card-transaction-purchase-withdraw.json') as CardTransactionInfoRecord;
    const record = { ...base, data: { ...base.data, cardPanPart: '9999' } };

    const result = normalizeTochkaRecord(record, options) as ReadyApplyRecord;

    expect(result.hmbee.category).toBe('Покупки / Продукты');
  });
});
