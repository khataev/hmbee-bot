## 1. SBP Preview Classification

- [ ] 1.1 Add preview classification support for the observed accepted outgoing `SbpC2BPayment` expense cases
- [ ] 1.2 Add preview classification support for the observed accepted incoming `SbpC2BRefund` income cases
- [ ] 1.3 Add transfer-first handling for `SbpB2CPayment` so non-transfer cases remain eligible for expense preview and own-account cases are excluded from the save-ready flow

## 2. SBP Preview Normalization

- [ ] 2.1 Extend Tochka preview normalization so the supported SBP families produce the correct income or expense preview output
- [ ] 2.2 Keep transfer-like own-account `SbpB2CPayment` cases out of save-ready income/expense normalization without adding transfer pairing logic

## 3. Verification

- [ ] 3.1 Add focused fixture-backed tests for `SbpC2BPayment`, `SbpC2BRefund`, and non-transfer `SbpB2CPayment`
- [ ] 3.2 Add focused tests proving transfer-like own-account `SbpB2CPayment` cases are identified but excluded rather than treated as save-ready income/expense
- [ ] 3.3 Validate the change with focused tests and `npm run check`