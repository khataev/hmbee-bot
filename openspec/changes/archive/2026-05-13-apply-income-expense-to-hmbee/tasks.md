## 1. Honey Money Draft Preparation

- [x] 1.1 Expand the preview `hmbee` branch into the full Honey Money transaction draft shape
- [x] 1.2 Add final amount normalization for Honey Money `real_amount` values
- [x] 1.3 Add focused tests for draft shaping, subtype handling, and rounding behavior

## 2. Apply Flow and Configuration

- [x] 2.1 Implement the non-preview `apply <source>` flow that sends identified income and expense records to Honey Money
- [x] 2.2 Add Honey Money environment validation and a dedicated client for `POST /transaction`
- [x] 2.3 Add Tochka-to-Honey-Money account mapping support in local configuration and fail-fast validation for missing mappings
- [x] 2.4 Capture created Honey Money transaction ids in structured command output

## 3. Targeted Operator Control and Verification

- [x] 3.1 Add `--only-id` so operators can apply only an explicit subset of identified source transaction ids
- [x] 3.2 Add focused tests for apply-selection behavior and keep preview/apply typing strict
- [x] 3.3 Update operator documentation for Honey Money apply setup and targeted testing
- [x] 3.4 Run final verification with `npm run check` and confirm OpenSpec artifact status for the change