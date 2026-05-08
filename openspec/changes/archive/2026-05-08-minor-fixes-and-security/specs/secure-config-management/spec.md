## ADDED Requirements

### Requirement: Secure Configuration Loading
The system SHALL prioritize environment-based configuration for sensitive source identifiers like `customerId`.

#### Scenario: Environment variable validation
- **WHEN** `validateTochkaEnv()` is called
- **THEN** it must ensure `TOCHKA_CUSTOMER_ID` is present and non-empty.
