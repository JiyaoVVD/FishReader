## ADDED Requirements

### Requirement: Explicit writing-mode lifecycle
The system SHALL provide commands to start, resume, normally exit, and immediately hide a stealth writing session without modifying the active source document or the saved reading position.

#### Scenario: Start writing from an active source editor
- **WHEN** the user starts writing mode while a source editor is active
- **THEN** the system SHALL open the writing surface, select or create an active draft, and use the active editor language to choose camouflage templates

#### Scenario: Start writing without an active source editor
- **WHEN** the user starts writing mode without an active source editor
- **THEN** the system SHALL open the writing surface with the generic camouflage template set

#### Scenario: Normal exit restores reading presentation
- **WHEN** the user normally exits writing mode
- **THEN** the system SHALL close the writing surface and restore the prior reading status presentation without changing the saved reading cursor

### Requirement: Real input remains separate from visible camouflage
The writing surface SHALL capture real input in a dedicated draft buffer and SHALL render only language-aware camouflage text in the editor-like input row.

#### Scenario: Insert real graphemes
- **WHEN** the user inserts one or more real-text grapheme clusters into the current segment
- **THEN** the draft buffer SHALL receive the real graphemes while the visible row advances by the same number of characters through the active camouflage template

#### Scenario: Delete real graphemes
- **WHEN** the user deletes grapheme clusters from the current segment
- **THEN** the draft buffer SHALL delete the corresponding real graphemes and the visible camouflage prefix SHALL retract by the same grapheme count

#### Scenario: Camouflage template is exhausted
- **WHEN** input advances beyond the end of the active camouflage template
- **THEN** the system SHALL rotate to the next template for the captured language and continue rendering a single-line camouflage prefix

#### Scenario: Submit current segment
- **WHEN** the user submits the current segment
- **THEN** the system SHALL append the real segment and a newline to the draft, clear the current segment, rotate the camouflage template, and keep the writing surface ready for further input

### Requirement: Camouflage templates are local and language-aware
The system SHALL select camouflage code or comment templates from a built-in local mapping keyed by VS Code language identifier and SHALL use a generic comment template when no language mapping exists.

#### Scenario: Known editor language
- **WHEN** writing mode starts from a supported TypeScript, JavaScript, Python, Lua, Markdown, or JSON editor
- **THEN** the visible camouflage SHALL use a template valid or visually plausible for that language

#### Scenario: Unknown editor language
- **WHEN** writing mode starts from an unsupported or unavailable language identifier
- **THEN** the visible camouflage SHALL use a neutral generic comment template

#### Scenario: Template generation is isolated from real content
- **WHEN** the system selects or rotates a camouflage template
- **THEN** it SHALL NOT derive that template from the real draft, workspace source text, network content, or an external generation service

### Requirement: Single-line input supports composition and paste
The writing surface SHALL preserve composed Unicode input and SHALL maintain one visible camouflage row even when real input contains multiple lines.

#### Scenario: Chinese IME composition completes
- **WHEN** a Chinese IME composition produces committed text
- **THEN** the system SHALL append the composed grapheme clusters exactly once to the real current segment and advance the camouflage display by the corresponding grapheme count

#### Scenario: Multi-line text is pasted
- **WHEN** the user pastes text containing line breaks
- **THEN** the system SHALL preserve complete pasted lines in the draft, retain the final partial line as the current segment, and continue displaying only one camouflage row

### Requirement: Status bar provides bounded real-text proofreading
While writing mode is visible, the status bar SHALL display the configured trailing real-text preview, total character count, and truthful save state.

#### Scenario: Real text is entered
- **WHEN** the user changes the current segment and preview length is greater than zero
- **THEN** the status bar SHALL display no more than the configured number of trailing grapheme clusters from the real draft and current segment

#### Scenario: Preview includes line breaks
- **WHEN** the bounded preview contains one or more line breaks
- **THEN** the status bar SHALL render each line break as `↵` without changing the stored draft

#### Scenario: Preview idle timeout elapses
- **WHEN** no real input occurs for the configured preview timeout
- **THEN** the system SHALL remove real text from the status bar and retain only character count and save state

#### Scenario: Preview is disabled
- **WHEN** the configured preview length is zero
- **THEN** the status bar SHALL NOT display real draft text at any time

#### Scenario: Save fails
- **WHEN** persistence of the latest draft content fails
- **THEN** the status bar SHALL display a failure state and SHALL NOT display `saved` for that revision

### Requirement: Emergency hide clears sensitive presentation
The system SHALL provide an emergency-hide action that prioritizes removing visible real text while retaining recoverable draft state.

#### Scenario: Emergency hide during active input
- **WHEN** the user invokes emergency hide while the writing surface is active
- **THEN** the system SHALL immediately close or conceal the writing surface, clear the real-text status preview, request a forced save, and retain the active draft for resume

#### Scenario: Focus-loss hiding is enabled
- **WHEN** the VS Code window is both unfocused and inactive while the writing focus-loss setting is enabled
- **THEN** the system SHALL apply the same presentation-clearing behavior without deleting the active draft

#### Scenario: IME candidate window causes a focus-only transition
- **WHEN** the VS Code window reports unfocused but remains active during inline IME interaction
- **THEN** the system SHALL keep the inline writing surface and draft session active

#### Scenario: Resume after emergency hide
- **WHEN** the user resumes a hidden writing session
- **THEN** the system SHALL restore the active draft and current segment with a freshly rendered camouflage row while leaving reading progress unchanged

### Requirement: Reading and writing presentations remain isolated
The system SHALL allow only the active mode to control FishReader's status-bar content and SHALL keep writing-session state separate from book-reading state.

#### Scenario: Enter writing mode during reading
- **WHEN** the user enters writing mode while a book and reading cursor are active
- **THEN** the system SHALL suspend the reading presentation without changing the book path, chapter index, line index, or content index

#### Scenario: Reading commands are invoked while writing surface has focus
- **WHEN** a FishReader reading-navigation keybinding would otherwise run while the writing surface has focus
- **THEN** the system SHALL prevent that keybinding from changing the reading cursor

#### Scenario: Exit writing mode after entering text
- **WHEN** the user exits writing mode after entering or saving draft text
- **THEN** the system SHALL restore the prior book and reading cursor independently of the writing draft

### Requirement: Current-file inline Comment mode is available
The system SHALL offer a native Comment-based writing surface attached to the active text editor without modifying the editor document, while retaining the hidden Webview surface for concealed live input.

#### Scenario: Start inline writing from an active editor
- **WHEN** the user invokes `FishReader: Start Inline Comment Writing` while a text editor is active
- **THEN** the system SHALL create an expanded comment thread at the current line, display only a language-aware fake submitted comment, and SHALL NOT open another editor tab or modify the source document

#### Scenario: Submit inline reply text
- **WHEN** the user submits text through the native comment reply control
- **THEN** the system SHALL commit and save the real reply text, update the status preview, clear the reply control, and continue displaying only fake submitted comment content

#### Scenario: Inline reply remains unsubmitted
- **WHEN** the user is typing in the native comment reply control before submission
- **THEN** the system SHALL treat that text as VS Code-owned transient input that is visibly rendered and not yet available for status preview, autosave, or recovery

#### Scenario: No active editor is available for inline mode
- **WHEN** inline writing starts without an active text editor
- **THEN** the system SHALL fall back to the hidden Webview surface without creating or modifying a workspace file

#### Scenario: Hidden live input is preferred
- **WHEN** the user invokes `FishReader: Start Hidden Webview Writing`
- **THEN** the system SHALL use the existing separately rendered Webview surface where real live input glyphs remain concealed

### Requirement: Writing command names are identifiable in the command palette
The system SHALL expose English command-palette titles beginning with `FishReader:` while retaining stable `fishreader.*` command identifiers.

#### Scenario: User searches for FishReader commands
- **WHEN** the user searches the command palette for `FishReader`
- **THEN** writing lifecycle, draft management, inline Comment, and hidden Webview commands SHALL be listed with English `FishReader:`-prefixed titles

### Requirement: Experimental current-editor inline capture is available
The system SHALL offer an explicitly activated experimental inline-capture surface that displays a fake line-end editor annotation, captures supported writing keys into the draft, and does not itself modify the anchored source document.

#### Scenario: Start inline capture from an active editor
- **WHEN** the user invokes `FishReader: Start Inline Capture` while a text editor is active
- **THEN** the system SHALL render a language-aware fake code/comment prefix at the end of the active line without opening another editor tab or editing the source document

#### Scenario: Type while inline capture is active
- **WHEN** the editor has text focus and the user types while `fishreader.inlineCaptureActive` is true
- **THEN** the system SHALL append the committed text to the active draft, advance the fake decoration, update the status preview, and SHALL NOT insert that text into the source document

#### Scenario: Type outside inline capture
- **WHEN** `fishreader.inlineCaptureActive` is false
- **THEN** FishReader SHALL delegate editor type and composition commands to their corresponding `default:*` commands so normal editor typing and IME behavior remain available

#### Scenario: Compose Chinese text during inline capture
- **WHEN** VS Code emits composition start, replacement/type updates, and composition end while inline capture is active
- **THEN** FishReader SHALL apply the intermediate replacement counts in a private buffer, commit the final composed text exactly once to the draft, and SHALL NOT change the source document or persist intermediate candidates

#### Scenario: Use supported inline editing keys
- **WHEN** the user invokes Backspace, Delete, Enter, paste, or Escape while inline capture and editor text focus are active
- **THEN** FishReader SHALL respectively retract draft input, submit the current segment, append clipboard text, or emergency-hide without routing those keys into the source document

#### Scenario: Anchored source document changes unexpectedly
- **WHEN** the anchored document version changes while inline capture is active
- **THEN** FishReader SHALL immediately hide the inline surface, clear sensitive presentation, request a draft save, and warn that the source edit must be reviewed without automatically undoing it

#### Scenario: Inline capture has no active editor
- **WHEN** inline capture starts without an active text editor
- **THEN** the system SHALL fall back to the hidden Webview surface
