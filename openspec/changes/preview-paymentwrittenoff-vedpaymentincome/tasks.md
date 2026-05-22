## 1. Preview Classification Rules

- [x] 1.1 Add preview classification support for the observed `PaymentWrittenOff` commission expense slice using whitelist-only `included` rules
- [x] 1.2 Add preview exclusion support for the observed transfer-like `PaymentWrittenOff` slice using explicit whitelist-only `excluded` rules
- [x] 1.3 Add preview classification support for the observed `VedPaymentIncome` undistributed income slice without forcing unconfirmed arrival states into included or excluded outcomes

## 2. Tochka Preview Normalization

- [x] 2.1 Extend Tochka preview normalization so `PaymentWrittenOff` records can produce the correct expense or excluded preview output for the supported slices
- [x] 2.2 Extend Tochka preview normalization so `VedPaymentIncome` records can produce the correct income preview output for the supported slice
- [x] 2.3 Keep transfer handling out of scope by classifying supported records independently without adding pairing or canonical transfer normalization

## 3. Verification

- [x] 3.1 Add focused fixture-backed tests for save-ready `PaymentWrittenOff` commission cases, excluded transfer-like `PaymentWrittenOff` cases, and unmatched `PaymentWrittenOff` cases
- [x] 3.2 Add focused fixture-backed tests for save-ready `VedPaymentIncome` cases and unmatched `VedPaymentIncome` states
- [x] 3.3 Validate the change with focused tests and `npm run check`