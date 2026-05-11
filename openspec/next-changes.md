# Next Changes

This note tracks the next planned OpenSpec changes without creating full change artifacts too early.

## 1. preview-normalized-income-expense

Focus:
- Add `apply <source> --preview`
- Read synchronized source files from `sync/<source>`
- Parse Tochka records for income and expense flows only
- Filter supported statuses (`Withdraw`, `InProgress`)
- Build a normalized internal representation
- Start the `hmbee` branch with category mapping output

Out of scope:
- Sending transactions to Honey Money
- SQLite persistence
- Transfer handling

## 2. apply-income-expense-to-hmbee

Focus:
- Expand `hmbee` into the full Honey Money transaction draft
- Add the rounding adapter for final amount normalization
- Send income and expense transactions to Honey Money
- Capture created Honey Money transaction identifiers from API responses

Out of scope:
- SQLite persistence
- Transfer handling

## 3. persist-import-registry

Focus:
- Add local SQLite persistence for imported transactions
- Store source transaction identifiers with Honey Money transaction identifiers
- Support safe reruns by checking the local import registry before saving

Out of scope:
- Transfer handling
- Broader sync history/reporting beyond the import registry
