import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeHoneyMoneyAmount, normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('Tochka Normalization', () => {
  const normalizationOptions = {
    accountMappings: {
      '40802810309500012345': 67890
    },
    accountRegistry: createAccountRegistry({
      sources: {
        tochka: {
          accountMappings: { '40802810309500012345': 67890 },
          hmAccounts: {},
          typeCodes: {}
        }
      }
    } as AppConfig),
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
    expect(result.normalized).toBeDefined();
    expect(result.hmbee).toBeDefined();
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
    const sbpMappings = {
      '40802810100000000001': 2053036,
      '40817810000000000001': 26755
    };
    const sbpOptions = {
      accountMappings: sbpMappings,
      accountRegistry: createAccountRegistry({
        sources: {
          tochka: {
            accountMappings: sbpMappings,
            hmAccounts: {},
            typeCodes: {}
          }
        }
      } as AppConfig),
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
                { '==': [{ var: 'record.data.status' }, 'CANCELED'] },
                { '==': [{ var: 'record.data.status' }, 'REJECTED'] },
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
                    { var: 'accountRegistry' }
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

    it('marks SbpC2BPayment invalid forms as identified but excluded (CANCELED/REJECTED/incoming=true)', () => {
      const invalidFixtures = [
        'sbp-c2b-payment-canceled.json',
        'sbp-c2b-payment-rejected.json',
        'sbp-c2b-payment-incoming.json'
      ];

      for (const fixtureName of invalidFixtures) {
        const fixture = loadFixture(fixtureName);
        const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, sbpOptions);

        expect(result.identified).toBe(true);
        expect(result.save).toBe(false);
        expect(result.reason).toBe('excluded');
      }
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

    it('uses shared account-registry heuristic for deposit-like SbpB2CPayment transfer handling', () => {
      const registryHeuristicOptions = {
        ...sbpOptions,
        accountRegistry: createAccountRegistry({
          sources: {
            tochka: {
              accountMappings: {
                '40802810100000000001': 2053036
              },
              hmAccounts: {},
              typeCodes: {}
            }
          }
        } as AppConfig)
      };

      const transferToDepositLikeAccount = {
        meta_data: {
          system_data: {
            type_code: 'SbpB2CPayment'
          },
          time_data: {
            event_date: '2026-05-09T10:00:00.000+05:00'
          }
        },
        data: {
          transactionId: 'sber-shared-registry-transfer',
          status: 'ACCEPTED',
          incoming: false,
          sum: 500,
          currency: 'RUB',
          title: 'Owned external transfer',
          payerAccountId: '40802810100000000001',
          payerBankBic: '044525104',
          payeeAccountId: '42109810620003872464',
          payeeBankBic: '044525104'
        }
      };

      const result = normalizeTochkaRecord(transferToDepositLikeAccount as TochkaSyncRecord, registryHeuristicOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.normalized?.type).toBe('transfer');
      expect(result.normalized?.counterpartyAccountId).toBe('42109810620003872464');
      expect(result.hmbee?.subtype).toBe('e');
    });
  });

  describe('RS/Arrival fixture-backed classification', () => {
    const rsMappings = {
      '40802810901500303852': 2053036,
      '40802810100000000002': 2053036,
      '40802810100000000001': 2053036
    };
    const rsOptions = {
      accountMappings: rsMappings,
      accountRegistry: createAccountRegistry({
        sources: {
          tochka: {
            accountMappings: rsMappings,
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
            excluded: {
              and: [
                { '==': [{ var: 'record.data.incoming' }, false] },
                { '==': [{ var: 'record.data.categoryTypeName' }, 'TRANSFER'] },
                { '==': [{ var: 'record.data.isComission' }, false] }
              ]
            }
          }
        },
        PaymentIncome: {
          conditions: {
            included: {
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
                    and: [
                      {
                        is_owned: [
                          { var: 'record.data.payerAccountId' },
                          { var: 'record.data.payerBankBic' },
                          { var: 'accountRegistry' }
                        ]
                      },
                      {
                        '!': {
                          or: [
                            {
                              is_deposit: [{ var: 'record.data.payerAccountId' }, { var: 'record.data.payerBankBic' }]
                            },
                            {
                              is_deposit: [{ var: 'record.data.payeeAccountId' }, { var: 'record.data.payeeBankBic' }]
                            }
                          ]
                        }
                      }
                    ]
                  }
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
                    or: [
                      {
                        is_deposit: [{ var: 'record.data.payerAccountId' }, { var: 'record.data.payerBankBic' }]
                      },
                      {
                        is_deposit: [{ var: 'record.data.payeeAccountId' }, { var: 'record.data.payeeBankBic' }]
                      }
                    ]
                  }
                }
              ]
            }
          }
        },
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

    it('canonicalizes deposit opening as a save-ready transfer with counterparty account', () => {
      const depositOpen = {
        meta_data: {
          system_data: {
            type_code: 'PaymentWrittenOff'
          },
          time_data: {
            event_date: '2026-03-31T16:42:51.815+05:00'
          }
        },
        data: {
          incoming: false,
          objectState: 'Processed',
          failed: false,
          isComission: false,
          categoryTypeName: 'DEPOSIT',
          sum: 173000,
          currency: 'RUB',
          title: 'Deposit opening',
          corebankingId: '92;4142283029',
          payerAccountId: '40802810901500303852',
          payerBankBic: '044525104',
          payeeAccountId: '42109810620003872464',
          payeeBankBic: '044525104'
        }
      };

      const result = normalizeTochkaRecord(depositOpen as TochkaSyncRecord, rsOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.normalized?.type).toBe('transfer');
      expect(result.normalized?.counterpartyAccountId).toBe('42109810620003872464');
      expect(result.hmbee?.subtype).toBe('e');
      expect(result.hmbee?.real_amount).toBe(-173000);
    });

    it('marks mirrored PaymentIncome transfer as identified but excluded', () => {
      const mirroredIncome = {
        meta_data: {
          system_data: {
            type_code: 'PaymentIncome'
          },
          time_data: {
            event_date: '2026-05-07T09:15:42.861+05:00'
          }
        },
        data: {
          incoming: true,
          objectState: 'Processed',
          failed: false,
          isComission: false,
          sum: 98000,
          currency: 'RUB',
          title: 'Mirrored transfer',
          corebankingId: '92;4335251007',
          payerAccountId: '40802810100000000001',
          payerBankBic: '044525104',
          payeeAccountId: '40802810901500303852',
          payeeBankBic: '044525104'
        }
      };

      const result = normalizeTochkaRecord(mirroredIncome as TochkaSyncRecord, rsOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(false);
      expect(result.reason).toBe('excluded');
      expect(result.normalized?.type).toBe('transfer');
      expect(result.normalized?.counterpartyAccountId).toBe('40802810100000000001');
    });

    it('keeps deposit principal return as save-ready income', () => {
      const depositReturn = {
        meta_data: {
          system_data: {
            type_code: 'PaymentIncome'
          },
          time_data: {
            event_date: '2026-04-30T07:10:10.501+05:00'
          }
        },
        data: {
          incoming: true,
          objectState: 'Processed',
          failed: false,
          isComission: false,
          sum: 173000,
          currency: 'RUB',
          title: 'Deposit principal return',
          corebankingId: '92;4299076045',
          payerAccountId: '42109810620003872464',
          payerBankBic: '044525104',
          payeeAccountId: '40802810901500303852',
          payeeBankBic: '044525104'
        }
      };

      const result = normalizeTochkaRecord(depositReturn as TochkaSyncRecord, rsOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.hmbee?.subtype).toBe('i');
      expect(result.hmbee?.real_amount).toBe(173000);
    });

    it('keeps deposit interest as ordinary save-ready income', () => {
      const depositInterest = {
        meta_data: {
          system_data: {
            type_code: 'PaymentIncome'
          },
          time_data: {
            event_date: '2026-05-01T10:00:00.000+05:00'
          }
        },
        data: {
          incoming: true,
          objectState: 'Processed',
          failed: false,
          isComission: false,
          sum: 1500,
          currency: 'RUB',
          title: 'Deposit interest',
          corebankingId: '92;DEPOSIT_INTEREST',
          payerAccountId: 'InterestPayment',
          payerBankBic: '044525104',
          payeeAccountId: '40802810901500303852',
          payeeBankBic: '044525104'
        }
      };

      const result = normalizeTochkaRecord(depositInterest as TochkaSyncRecord, rsOptions);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.hmbee?.subtype).toBe('i');
      expect(result.hmbee?.real_amount).toBe(1500);
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
