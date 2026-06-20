# planned-transaction-confirmation

## Purpose
Building and sending confirmation payloads for bank records matched to unconfirmed Honey Money plans.

## Requirements

### Requirement: Confirmation payload echoes the plan and injects bank values
The system SHALL build the confirmation payload for a matched record from the matched plan, echoing the plan identity and recurrence and injecting the bank-derived amount and date.

#### Scenario: Build a confirmation payload
- **WHEN** a record is matched to an unconfirmed plan
- **THEN** the confirmation `hmbee` carries the plan `id`, `type=planned`, `plan_amount`, `common_id`, `virtual_id`, and the plan recurrence fields `planned_repeat_days`, `planned_repeat_end`, `planned_repeat_end_date`
- **AND** `real_amount` is set to the normalized bank amount and `date` is set to the bank transaction date
- **AND** `description` is built from the category mapping in the same way as a create draft

#### Scenario: Server-managed fields are not sent
- **WHEN** the confirmation payload is built
- **THEN** it does not include `user_id`, `created_from`, `created_at`, `updated_at`, or `planned_repeat_end_times`

### Requirement: Honey Money client sends a plan confirmation
The system SHALL send the confirmation payload to the Honey Money transaction endpoint and SHALL return the confirmed transaction id.

#### Scenario: Send a confirmation
- **WHEN** the client sends a confirmation `hmbee` (with a non-null `id`)
- **THEN** it issues a `POST` to the Honey Money `/transaction` endpoint with the same authentication as the create path
- **AND** it returns the confirmed transaction id from a successful response

#### Scenario: Confirmation failure surfaces a clear error
- **WHEN** the Honey Money confirmation request returns a non-success status
- **THEN** the client fails with an error identifying the failed confirmation
- **AND** the error MUST NOT include full cookie/session/token values
