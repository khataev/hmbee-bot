## ADDED Requirements

### Requirement: Apply write path sends only create drafts in this change
The system SHALL send to Honey Money only create drafts (`hmbee.id == null`) during non-preview apply, and SHALL defer confirmation drafts (`hmbee.id != null`) without sending them, because confirmation execution is delivered by a separate change.

#### Scenario: Create drafts are written
- **WHEN** non-preview `apply <source>` processes a save-ready record whose `hmbee.id` is null
- **THEN** the system sends it to the Honey Money create path as before
