## MODIFIED Requirements

### Requirement: Map Tochka category from source-specific rules
The system SHALL resolve Honey Money category mapping by evaluating both Merchant Category Codes (MCC) and transaction title keywords against mapping rules loaded from `AppConfig` (`hmbee.categoryMapping`). Hardcoded `MCC_MAP` and `TITLE_MAP` constants are removed; all mapping rules come exclusively from config.

#### Scenario: Map Tochka category from MCC
- **WHEN** an identified Tochka preview record has an MCC that matches a mapping entry in `hmbee.categoryMapping.mcc`
- **THEN** the preview output includes the corresponding Honey Money category in the `hmbee` branch

#### Scenario: Map Tochka category from transaction title keyword
- **WHEN** an identified Tochka preview record does not have a matching MCC but its title contains a recognized keyword from `hmbee.categoryMapping.title`
- **THEN** the preview output includes the corresponding Honey Money category in the `hmbee` branch

#### Scenario: MCC match takes priority over title match
- **WHEN** an identified Tochka preview record has both a matching MCC and a matching title keyword that result in different categories
- **THEN** the system SHALL prioritize the MCC match for category assignment

#### Scenario: Mapped description is included in hmbee transaction description
- **WHEN** an identified Tochka preview record matches a mapping entry that has a `description` field
- **THEN** the hmbee transaction `description` in the preview output is `"${Math.abs(amount)} ${entry.description}"`

#### Scenario: No mapped description yields amount-only hmbee description
- **WHEN** an identified Tochka preview record matches a mapping entry without `description`, or matches no entry
- **THEN** the hmbee transaction `description` in the preview output is `String(Math.abs(amount))`

#### Scenario: Empty categoryMapping yields null category
- **WHEN** `hmbee.categoryMapping` contains no entries matching the record's MCC or title
- **THEN** the hmbee category in the preview output is `null`
