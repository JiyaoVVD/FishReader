## Purpose

Define persistent per-book reading positions and restoration of the most recently opened book across VS Code sessions.

## Requirements

### Requirement: Persist reading progress per book
The system SHALL store the reading progress for each book in `globalState` so that it survives VS Code restarts. Progress includes `chapterIndex`, `lineIndex`, and `contentIndex`.

#### Scenario: Progress saved on page turn
- **WHEN** the user advances to the next line (nextLine), previous line (prevLine), next chapter (nextChapter), previous chapter (prevChapter), or selects a chapter (setChapter/openChapter)
- **THEN** the system SHALL update the stored progress for the current book in `globalState`

#### Scenario: Progress stored per book path
- **WHEN** the user reads book A then switches to book B
- **THEN** the system SHALL maintain separate progress entries keyed by each book's path identifier

### Requirement: Persist last opened book
The system SHALL store the path identifier of the most recently opened book in `globalState` under the key `lastBook`.

#### Scenario: Last book updated on book open
- **WHEN** the user opens a book (via tree view click or chapter selection)
- **THEN** the system SHALL update the `lastBook` value in `globalState` to the current book's path identifier

### Requirement: Restore reading position on activation
The system SHALL attempt to restore the user's last reading position when the extension activates.

#### Scenario: Full restore on restart
- **WHEN** VS Code starts AND `lastBook` is set in `globalState` AND the corresponding book file still exists AND a saved progress exists for that book
- **THEN** the system SHALL load the book data, navigate to the saved `chapterIndex`, `lineIndex`, and `contentIndex`, and display the corresponding content in the status bar

#### Scenario: Book file deleted since last session
- **WHEN** VS Code starts AND `lastBook` is set but the referenced file no longer exists
- **THEN** the system SHALL silently skip restoration and start with default empty state

#### Scenario: No last book stored
- **WHEN** VS Code starts AND no `lastBook` value exists in `globalState`
- **THEN** the system SHALL start with the default empty state (no book loaded)

### Requirement: StatusBarReader exposes position get/set
`StatusBarReader` SHALL provide `getPosition()` and `setPosition()` methods to serialize and restore the reading cursor.

#### Scenario: getPosition returns current cursor
- **WHEN** `getPosition()` is called
- **THEN** it SHALL return an object with `chapterIndex`, `lineIndex`, and `contentIndex` reflecting the current reading position

#### Scenario: setPosition restores cursor
- **WHEN** `setPosition({ chapterIndex, lineIndex, contentIndex })` is called with valid indices
- **THEN** the reader SHALL update its internal state and refresh the displayed content accordingly

#### Scenario: setPosition with out-of-range values
- **WHEN** `setPosition()` is called with a `chapterIndex` that exceeds the available chapters
- **THEN** the reader SHALL clamp to the last available chapter and reset `lineIndex` and `contentIndex` to 0
