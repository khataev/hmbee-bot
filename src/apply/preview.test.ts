import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeHoneyMoneyAmount, normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import { describe, expect, it } from 'vitest';

describe('Tochka Normalization', () => {
  const normalizationOptions = {
    accountMappings: {
      '40802810309500012345': 67890
    },
    ownedAccountRegistry: {
      isOwned: (acc: string) => acc === '40802810309500012345',
      getHmAccountId: (acc: string) => (acc === '40802810309500012345' ? 67890 : undefined)
    },
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
              }
            ]
          }
        }
      }
    }
  };

  const mockBaseRecord = {
    meta_data: {
      system_data: {
        type_code: 'CardTransactionInfo'
      },
      time_data: {
        event_date: '2026-04-27T11:48:03.000+05:00'
      }
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

  it('should identify supported Purchase with InProgress status', () => {
    const result = normalizeTochkaRecord(mockBaseRecord, normalizationOptions);
    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.transactionId).toBe('4223584703');
    expect(result.normalized?.amount).toBe(241.07);
    expect(result.normalized?.status).toBe('InProgress');
    expect(result.hmbee?.category).toBe('Услуги / Коворкинг');
    expect(result.hmbee?.subtype).toBe('e');
    expect(result.hmbee?.date).toBe('2026-04-27');
    expect(result.hmbee?.currency).toBe('rub');
    expect(result.hmbee?.real_amount).toBe(-241);
    expect(result.hmbee?.account_id).toBe(67890);
  });

  it('should map Yandex Taxi to Проезд / Такси', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, title: 'Yandex*4121*Taxi', description: undefined, mcc: '4121' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.hmbee?.category).toBe('Проезд / Такси');
  });

  it('should mark CheckCard as identified but excluded', () => {
    const record = {
      ...mockBaseRecord,
      data: {
        ...mockBaseRecord.data,
        tranCode: 'CheckCard',
        status: 'InProgress'
      }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('excluded');
    expect(result.normalized).toBeUndefined();
    expect(result.hmbee).toBeUndefined();
  });

  it('should mark canceled Purchase as identified but excluded', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Canceled' }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('excluded');
  });

  it('should identify supported Purchase with Withdraw status', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Withdraw' }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.status).toBe('Withdraw');
  });

  it('should not identify record with no matching include or exclude rule', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Received' }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('no matching included/excluded condition');
    expect(result.normalized).toBeUndefined();
  });

  it('should fail identification on included/excluded ambiguity', () => {
    const optionsWithAmbiguity = {
      ...normalizationOptions,
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

  it('should not identify unsupported type_code values', () => {
    const record = {
      ...mockBaseRecord,
      meta_data: {
        ...mockBaseRecord.meta_data,
        system_data: {
          type_code: 'UnknownType'
        }
      }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('unsupported type_code: UnknownType');
  });

  it('should return identified: false on parsing error', () => {
    const result = normalizeTochkaRecord({ wrong: 'shape' } as unknown as TochkaSyncRecord, normalizationOptions);
    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBeTypeOf('string');
    expect(result.sourceRecord).toEqual({ wrong: 'shape' });
    expect(result.normalized).toBeUndefined();
  });

  it('should map category based on MCC', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '5411', title: 'Unknown Merchant' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.hmbee?.category).toBe('Покупки / Продукты');
  });

  it('should map category based on merchant title keyword (exact-ish)', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '0000', title: 'WHOOSH' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.hmbee?.category).toBe('Услуги / Аренда самокатов');
  });

  it('should map category based on merchant title keyword (partial match)', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '0000', title: 'CP* WHOOSH.BIKE' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.hmbee?.category).toBe('Услуги / Аренда самокатов');
  });

  it('should normalize outgoing and incoming amounts for Honey Money', () => {
    expect(normalizeHoneyMoneyAmount(241.07, 'e')).toBe(-241);
    expect(normalizeHoneyMoneyAmount(169.99, 'e')).toBe(-170);
    expect(normalizeHoneyMoneyAmount(241.07, 'i')).toBe(241);
  });

  describe('SBP fixture-backed classification', () => {
    const sbpOptions = {
      accountMappings: {
        '40802810100000000001': 2053036,
        '40817810000000000001': 26755
      },
      ownedAccountRegistry: {
        isOwned: (acc: string) => acc === '40802810100000000001' || acc === '40817810000000000001',
        getHmAccountId: (acc: string) =>
          acc === '40802810100000000001' ? 2053036 : acc === '40817810000000000001' ? 26755 : undefined
      },
      typeCodeRules: {
        SbpC2BPayment: {
          conditions: {
            included: {
              and: [
                { '==': [{ var: 'record.data.status' }, 'ACCEPTED'] },
                { '==': [{ var: 'record.data.incoming' }, false] }
              ]
            },
            excluded: {
              or: [
                {
                  or: [
                    { '==': [{ var: 'record.data.status' }, 'CANCELED'] },
                    { '==': [{ var: 'record.data.status' }, 'REJECTED'] }
                  ]
                },
                { '==': [{ var: 'record.data.incoming' }, true] }
              ]
            }
          }
        },
        SbpC2BRefund: {
          conditions: {
            included: {
              and: [
                { '==': [{ var: 'record.data.status' }, 'ACCEPTED'] },
                { '==': [{ var: 'record.data.incoming' }, true] }
              ]
            },
            excluded: {
              or: [
                {
                  or: [
                    { '==': [{ var: 'record.data.status' }, 'CANCELED'] },
                    { '==': [{ var: 'record.data.status' }, 'REJECTED'] }
                  ]
                },
                { '==': [{ var: 'record.data.incoming' }, false] }
              ]
            }
          }
        },
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
                    { var: 'ownedAccountRegistry' }
                  ]
                }
              ]
            },
            excluded: {
              or: [
                {
                  or: [
                    { '==': [{ var: 'record.data.status' }, 'CANCELED'] },
                    { '==': [{ var: 'record.data.status' }, 'REJECTED'] }
                  ]
                },
                { '==': [{ var: 'record.data.incoming' }, true] }
              ]
            }
          }
        }
      }
    };

    function loadFixture(fileName: string): unknown {
      const filePath = resolve(process.cwd(), 'src', 'apply', 'preview', 'fixtures', fileName);
      const fileContents = readFileSync(filePath, 'utf8');
      return JSON.parse(fileContents) as unknown;
    }

    it('classifies SbpC2BPayment fixtures as save-ready expenses', () => {
      const c2bPayment = loadFixture('sbp-c2b-payment.json');

      const result = normalizeTochkaRecord(c2bPayment as TochkaSyncRecord, sbpOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.hmbee?.subtype).toBe('e');
      expect(result.hmbee?.real_amount).toBe(-3392);
      expect(result.hmbee?.account_id).toBe(2053036);
    });

    it('classifies SbpC2BRefund fixtures as save-ready income', () => {
      const c2bRefund = loadFixture('sbp-c2b-refund.json');

      const result = normalizeTochkaRecord(c2bRefund as TochkaSyncRecord, sbpOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.hmbee?.subtype).toBe('i');
      expect(result.hmbee?.real_amount).toBe(439);
      expect(result.hmbee?.account_id).toBe(2053036);
    });

    it('classifies non-transfer SbpB2CPayment as save-ready expense', () => {
      const nonTransferB2C = loadFixture('sbp-b2c-payment-non-transfer.json');

      const result = normalizeTochkaRecord(nonTransferB2C as TochkaSyncRecord, sbpOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.hmbee?.subtype).toBe('e');
      expect(result.hmbee?.real_amount).toBe(-150);
      expect(result.hmbee?.account_id).toBe(2053036);
    });

    it('identifies transfer-like SbpB2CPayment as save-ready canonical transfer', () => {
      const transferLikeB2C = loadFixture('sbp-b2c-payment-own-transfer.json');

      const result = normalizeTochkaRecord(transferLikeB2C as TochkaSyncRecord, sbpOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.normalized?.type).toBe('transfer');
      expect(result.normalized?.counterpartyAccountId).toBe('40817810000000000001');
      expect(result.hmbee?.subtype).toBe('e');
    });
  });

  describe('RS/Arrival fixture-backed classification', () => {
    const rsOptions = {
      accountMappings: {
        '40802810100000000001': 2053036
      },
      ownedAccountRegistry: {
        isOwned: (acc: string) => acc === '40802810100000000001',
        getHmAccountId: (acc: string) => (acc === '40802810100000000001' ? 2053036 : undefined)
      },
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
                        { var: 'ownedAccountRegistry' }
                      ]
                    },
                    {
                      is_owned: [
                        { var: 'record.data.payeeAccountId' },
                        { var: 'record.data.payeeBankBic' },
                        { var: 'ownedAccountRegistry' }
                      ]
                    }
                  ]
                }
              ]
            },
            excluded: {
              and: [
                { '==': [{ var: 'record.data.incoming' }, false] },
                { '==': [{ var: 'record.data.categoryTypeName' }, 'TRANSFER'] },
                { '==': [{ var: 'record.data.isComission' }, false] }
              ]
            }
          }
        },
        VedPaymentIncome: {
          conditions: {
            included: {
              and: [
                { '==': [{ var: 'record.data.state' }, 'UNDISTRIBUTED'] },
                { in: [{ var: 'record.data.recipientAccountId' }, { var: 'accountRegistry' }] }
              ]
            },
            excluded: { or: [] }
          }
        }
      }
    };

    function loadFixture(fileName: string): unknown {
      const filePath = resolve(process.cwd(), 'src', 'apply', 'preview', 'fixtures', fileName);
      const fileContents = readFileSync(filePath, 'utf8');
      return JSON.parse(fileContents) as unknown;
    }

    it('classifies PaymentWrittenOff commission as save-ready expense', () => {
      const commission = loadFixture('payment-written-off-commission.json');

      const result = normalizeTochkaRecord(commission as TochkaSyncRecord, rsOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.hmbee?.subtype).toBe('e');
      expect(result.hmbee?.real_amount).toBe(-100);
    });

    it('identifies transfer-like PaymentWrittenOff but excludes from save-ready flow', () => {
      const transfer = loadFixture('payment-written-off-transfer.json');

      const result = normalizeTochkaRecord(transfer as TochkaSyncRecord, rsOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(false);
      expect(result.reason).toBe('excluded');
    });

    it('remains unmatched for unknown PaymentWrittenOff shapes', () => {
      const unknownWrittenOff = {
        meta_data: {
          system_data: { type_code: 'PaymentWrittenOff' },
          time_data: { event_date: '2026-05-04T10:53:12.465+05:00' }
        },
        data: {
          incoming: false,
          objectState: 'Processed',
          failed: false,
          isComission: false,
          categoryTypeName: 'OTHERS',
          sum: 100,
          currency: 'RUB',
          title: 'Unknown',
          corebankingId: '92;123',
          payerAccountId: '40802810100000000001'
        }
      };

      const result = normalizeTochkaRecord(unknownWrittenOff as TochkaSyncRecord, rsOptions);

      expect(result.identified).toBe(false);
      expect(result.reason).toBe('no matching included/excluded condition');
    });

    it('classifies VedPaymentIncome (UNDISTRIBUTED) as save-ready income', () => {
      const income = loadFixture('ved-payment-income-undistributed.json');

      const result = normalizeTochkaRecord(income as TochkaSyncRecord, rsOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.hmbee?.subtype).toBe('i');
      expect(result.hmbee?.real_amount).toBe(498672);
      expect(result.hmbee?.account_id).toBe(2053036);
    });

    it('remains unmatched for non-undistributed VedPaymentIncome states', () => {
      const processingIncome = {
        meta_data: {
          system_data: { type_code: 'VedPaymentIncome' },
          time_data: { event_date: '2026-04-08T13:08:48.058+05:00' }
        },
        data: {
          state: 'PROCESSING',
          recipientAccountId: '40802810100000000001',
          sum: 100,
          currency: 'RUB',
          title: 'Processing',
          incomeId: 123
        }
      };

      const result = normalizeTochkaRecord(processingIncome as TochkaSyncRecord, rsOptions);

      expect(result.identified).toBe(false);
      expect(result.reason).toBe('no matching included/excluded condition');
    });
  });
});
