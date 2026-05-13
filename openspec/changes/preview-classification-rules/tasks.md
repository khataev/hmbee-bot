## 1. Preview Record Contract

- [ ] 1.1 Update preview record types to expose `identified`, `save`, and `reason`
- [ ] 1.2 Ensure save-ready identified records emit `reason: null`
- [ ] 1.3 Ensure excluded and not-identified records preserve a non-null `reason`

## 2. Source Config Rules

- [ ] 2.1 Add config support for source-level `type_codes` classification rules
- [ ] 2.2 Validate `included` and `excluded` condition arrays at config load time
- [ ] 2.3 Keep rule objects as flat field/value match dictionaries for the first iteration

## 3. CardTransactionInfo Classification

- [ ] 3.1 Apply config-driven rules to Tochka `CardTransactionInfo`
- [ ] 3.2 Mark `CheckCard` and canceled purchases as identified but excluded
- [ ] 3.3 Mark supported purchase records as identified and save-ready
- [ ] 3.4 Mark unmatched or ambiguous records as not identified with a reason

## 4. Verification

- [ ] 4.1 Add focused tests for included, excluded, unmatched, and ambiguous outcomes
- [ ] 4.2 Validate the change with `npm run check` and the focused preview tests
