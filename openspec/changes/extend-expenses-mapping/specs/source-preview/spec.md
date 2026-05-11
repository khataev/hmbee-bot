## MODIFIED Requirements

### Requirement: Map Tochka category from source-specific rules
The system SHALL resolve Honey Money category mapping by evaluating both Merchant Category Codes (MCC) and transaction title keywords against a set of mapping rules for Tochka.

#### Scenario: Map Tochka category from MCC
- **WHEN** an identified Tochka preview record has an MCC that matches a mapping rule (e.g., `5411` or `5499` for `Покупки / Продукты`)
- **THEN** the preview output includes the corresponding Honey Money category in the `hmbee` branch

#### Scenario: Map Tochka category from transaction title keyword
- **WHEN** an identified Tochka preview record does not have a matching MCC but its title contains a recognized keyword (e.g., `Whoosh` for `Услуги / Аренда самокатов`)
- **THEN** the preview output includes the corresponding Honey Money category in the `hmbee` branch

#### Scenario: MCC match takes priority over title match
- **WHEN** an identified Tochka preview record has both a matching MCC and a matching title keyword that result in different categories
- **THEN** the system SHALL prioritize the MCC match for category assignment
