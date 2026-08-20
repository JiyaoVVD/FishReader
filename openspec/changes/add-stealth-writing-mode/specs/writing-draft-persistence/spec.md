## ADDED Requirements

### Requirement: Drafts are stored locally outside the workspace
The system SHALL store internal draft bodies in the extension's local global-storage area and SHALL NOT create or modify workspace files unless the user explicitly exports a draft.

#### Scenario: Create a new draft
- **WHEN** the user creates a draft
- **THEN** the system SHALL assign a stable draft identifier, create local metadata, and initialize an empty body outside the workspace

#### Scenario: Enter text without exporting
- **WHEN** the user enters and saves draft text but does not invoke export
- **THEN** no source-controlled or other workspace file SHALL be created or modified by the writing feature

### Requirement: Draft changes are autosaved and force-saved at lifecycle boundaries
The system SHALL debounce saves after input changes and SHALL request an immediate save when the user commits a segment, switches drafts, hides or exits writing mode, or closes the writing surface.

#### Scenario: Input pauses after a change
- **WHEN** the current segment changes and no further change occurs for the configured autosave debounce interval
- **THEN** the repository SHALL persist the full real draft including the uncommitted current segment

#### Scenario: User commits a segment
- **WHEN** the user submits the current segment
- **THEN** the repository SHALL request an immediate save of the newly committed content

#### Scenario: User switches drafts
- **WHEN** the user selects another draft
- **THEN** the system SHALL attempt to save the current draft before activating the selected draft

#### Scenario: Persistence reports success
- **WHEN** the latest requested draft revision is durably written
- **THEN** the repository SHALL report that revision as saved to the writing session

### Requirement: Draft writes avoid partial replacement
The repository SHALL write draft content through a temporary sibling resource and replace the destination only after the temporary write succeeds.

#### Scenario: Temporary write succeeds
- **WHEN** the repository finishes writing a temporary draft revision
- **THEN** it SHALL replace the destination body with that complete revision and update saved metadata

#### Scenario: Temporary write fails
- **WHEN** the temporary draft write or destination replacement fails
- **THEN** the repository SHALL retain the last complete stored body, keep the newest revision in memory when possible, and report a save failure

### Requirement: Last active draft is recoverable
The system SHALL remember the active draft and recover its latest complete autosaved content when a writing session resumes after extension activation or window restart.

#### Scenario: Resume after normal restart
- **WHEN** VS Code restarts and the remembered active draft body exists
- **THEN** resuming writing mode SHALL load that draft content, metadata, and recoverable current segment

#### Scenario: Remembered draft body is missing
- **WHEN** the active draft metadata exists but its body file is missing or unreadable
- **THEN** the system SHALL report the recovery problem and SHALL NOT silently replace the missing draft with an empty body

#### Scenario: No active draft is remembered
- **WHEN** writing mode starts without a remembered active draft
- **THEN** the system SHALL offer existing drafts or create a new draft without affecting reading state

### Requirement: Users can select and identify local drafts
The system SHALL provide commands to create, list, select, and rename local drafts using metadata that does not contain the full draft body.

#### Scenario: List existing drafts
- **WHEN** the user invokes draft selection
- **THEN** the system SHALL list drafts by title and last-updated time without loading every full body into the selection UI

#### Scenario: Rename active draft
- **WHEN** the user assigns a valid non-empty title to the active draft
- **THEN** the system SHALL update its metadata without rewriting or exposing the body in the workspace

### Requirement: Draft export is explicit and UTF-8 encoded
The system SHALL export a selected draft only after an explicit user command and destination choice, using UTF-8 TXT or Markdown output.

#### Scenario: Export as TXT
- **WHEN** the user chooses a `.txt` destination and confirms export
- **THEN** the system SHALL write the complete real draft as UTF-8 plain text to that destination

#### Scenario: Export as Markdown
- **WHEN** the user chooses a `.md` destination and confirms export
- **THEN** the system SHALL write the complete real draft as UTF-8 Markdown-compatible text without adding camouflage content

#### Scenario: Export is cancelled
- **WHEN** the user cancels destination selection
- **THEN** the system SHALL leave internal draft content and external files unchanged

### Requirement: Concurrent revisions are not silently overwritten
The repository SHALL detect when the stored draft revision changed after the current session loaded it and SHALL refuse an unqualified overwrite.

#### Scenario: Revision conflict is detected
- **WHEN** a save observes a newer stored revision than the session's base revision
- **THEN** the system SHALL preserve both the stored content and the in-memory content, report a conflict, and require an explicit user resolution before replacement
