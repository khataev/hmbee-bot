## ADDED Requirements

### Requirement: Identified income or expense records require a resolved category to stay save-ready
The system SHALL treat a resolved Honey Money category as mandatory for save-ready income and expense preview records. When a preview record is identified, classified in the income or expense flow (Honey Money `subtype` `i` or `e`), and its resolved `hmbee.category` is `null`, the system SHALL downgrade it to not save-ready with `identified = true`, `save = false`, and `reason = "Category is missing for income or expense transaction"`. This downgrade SHALL take precedence over the save-ready outcome produced by `included`/`excluded` classification.

#### Scenario: Income record with missing category is not save-ready
- **WHEN** a synchronized Tochka source record is identified and classified in the income flow (Honey Money `subtype = i`)
- **AND** category resolution produces `hmbee.category = null` (no MCC or title mapping matched)
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "Category is missing for income or expense transaction"`
- **AND** the preview output still includes the `hmbee` branch for operator inspection

#### Scenario: Expense record with missing category is not save-ready
- **WHEN** a synchronized Tochka source record is identified and classified in the expense flow (Honey Money `subtype = e`)
- **AND** category resolution produces `hmbee.category = null` (no MCC or title mapping matched)
- **THEN** the preview record has `identified = true`
- **AND** the preview record has `save = false`
- **AND** the preview record has `reason = "Category is missing for income or expense transaction"`
- **AND** the preview output still includes the `hmbee` branch for operator inspection

#### Scenario: Income or expense record with a resolved category stays save-ready
- **WHEN** a synchronized Tochka source record is identified and classified in the income or expense flow
- **AND** category resolution produces a non-null `hmbee.category`
- **THEN** the missing-category downgrade does not apply
- **AND** the preview record keeps the `save` and `reason` values produced by `included`/`excluded` classification

#### Scenario: Transfer records are not subject to the category requirement
- **WHEN** a synchronized Tochka source record is identified and classified in the transfer flow (Honey Money `subtype = t`)
- **AND** the preview record has `hmbee.category = null`
- **THEN** the missing-category downgrade does not apply
- **AND** the preview record keeps the `save` and `reason` values produced by `included`/`excluded` classification

#### Scenario: Unidentified records are not subject to the category requirement
- **WHEN** a synchronized Tochka source record has `identified = false`
- **THEN** the missing-category downgrade does not apply
- **AND** the preview record keeps its existing `save = false` and non-null `reason`
