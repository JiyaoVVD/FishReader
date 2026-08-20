## 1. Writing Mode Foundations

- [x] 1.1 Add writing commands, context keys, and settings for preview length, preview timeout, autosave debounce, focus-loss hiding, and optional user-defined keybindings.
- [x] 1.2 Define shared writing message, draft metadata, revision, save-state, and mode-state types with versioned persisted schemas.
- [x] 1.3 Extract mode-aware status presentation from the activation function so reading and writing can share one status-bar item without sharing cursor or session state.
- [x] 1.4 Implement `ModeController` transitions for start, resume, normal exit, presentation hide/show, and emergency hide while preserving the active reading state.
- [x] 1.5 Guard an empty `defaultBookPath` during activation so writing mode and extension-host tests do not scan a drive root when no book library is configured.

## 2. Camouflage and Input State

- [x] 2.1 Implement grapheme-safe utilities for counting, trailing preview extraction, deletion, and newline-to-`↵` formatting, with Unicode and Chinese test cases.
- [x] 2.2 Implement `CamouflageTemplateProvider` with deterministic TypeScript/JavaScript, Python, Lua, Markdown, JSON, and generic template sets.
- [x] 2.3 Implement a pure `WriterSession` state model for real committed content, current segment, language selection, decoy advancement/retraction, template rotation, character count, and revision tracking.
- [x] 2.4 Add state-model tests for insertion, deletion, template exhaustion, Enter submission, multi-line paste, and composed Unicode input.

## 3. Local Draft Repository

- [x] 3.1 Implement versioned draft index storage in `globalState` and UTF-8 draft bodies under `globalStorageUri/drafts`.
- [x] 3.2 Implement draft creation, metadata-only listing, loading, selection, active-draft tracking, and non-empty title renaming.
- [x] 3.3 Implement debounced saves and forced lifecycle saves using temporary sibling writes and destination replacement.
- [x] 3.4 Implement saved-revision acknowledgements, write-failure retention, and concurrent-revision conflict detection without silent overwrite.
- [x] 3.5 Implement recovery of the remembered active draft and explicit error handling for missing or unreadable bodies.
- [x] 3.6 Implement explicit UTF-8 TXT and Markdown export through a save dialog without otherwise writing to the workspace.
- [x] 3.7 Add repository tests for create/load/list/rename, autosave, atomic replacement failure, recovery, export cancellation, and revision conflict.

## 4. Editor-Like Writing Surface

- [x] 4.1 Implement a CSP-restricted writing Webview in the active editor group using VS Code theme colors, editor typography, gutter spacing, and a single visible camouflage row.
- [x] 4.2 Implement the positioned one-row real-input control and separate decoy renderer so real glyphs never appear in the writing surface while focus and IME candidate positioning remain usable.
- [x] 4.3 Implement Webview-to-extension messaging for input changes, composition boundaries, deletion, paste, segment submission, readiness, disposal, and save acknowledgements.
- [x] 4.4 Keep the surface single-line while rotating decoy templates and preserve complete pasted lines plus the final active segment in the real session state.
- [x] 4.5 Add tests for the Webview message reducer and rendering model, including duplicate composition events and stale revision acknowledgements.

## 5. Status Preview and Lifecycle Integration

- [x] 5.1 Implement writing status output with bounded trailing real-text preview, total character count, and saving/saved/failure/conflict states.
- [x] 5.2 Implement idle-time preview removal, zero-length preview disabling, and mode-aware reuse of FishReader's existing show/hide commands.
- [x] 5.3 Wire writing commands and Webview lifecycle into `ModeController`, `WriterSession`, `DraftRepository`, and `StatusBarPresenter` from extension activation.
- [x] 5.4 Implement emergency hide and optional focus-loss hiding so visible real text clears immediately, the surface closes, and a forced save is requested without exposing failures.
- [x] 5.5 Prevent reading-navigation keybindings from changing the book cursor while the writing surface has focus and restore the exact prior reading presentation on normal exit.

## 6. Verification and Documentation

- [x] 6.1 Add extension-host integration tests covering start/resume/exit, draft recovery, status preview timeout, emergency hide, and no workspace-file mutation before export.
- [x] 6.2 Add regressions proving writing operations do not change the active book path or `chapterIndex`, `lineIndex`, and `contentIndex` reading progress.
- [ ] 6.3 Manually verify inline-capture, inline Comment, and hidden-Webview Chinese IME composition plus paste, deletion, submit, resume, focus loss, and emergency hide on Windows.
- [ ] 6.4 Visually verify the camouflage surface and status bar in representative light, dark, and high-contrast VS Code themes.
- [x] 6.5 Document commands, settings, draft location, export, recovery, and the visual-camouflage threat-model boundary in README and release notes.
- [x] 6.6 Run type checking, lint, the full extension test suite, production packaging, and a local VSIX smoke test before marking the change complete.

## 7. Current-File Inline Comment Follow-up

- [x] 7.1 Implement a native `CommentController` surface anchored to the active cursor line with language-aware fake comment content and placeholder text, without modifying the source document.
- [x] 7.2 Make inline Comment writing the current-file entry point, retain an explicit hidden-Webview command, remember the selected surface for resume, and fall back to Webview when no text editor is active.
- [x] 7.3 Route submitted Comment replies into `WriterSession`, immediate persistence, status proofreading, emergency hide, and normal exit while documenting that unsubmitted Comment text is visible and transient.
- [x] 7.4 Rename contributed command-palette titles to English `FishReader:`-prefixed names without changing existing `fishreader.*` identifiers.
- [x] 7.5 Add focused Comment-surface and controller tests, update README/release notes, rerun strict OpenSpec and full extension validation, then rebuild and reinstall the local VSIX.

## 8. Experimental Current-Editor Inline Capture

- [x] 8.1 Add the decoration surface, inline-capture surface kind, scoped context key, and pure input helpers without using editor or workspace edits.
- [x] 8.2 Intercept `type` only during an active inline-capture session, delegate to `default:type` otherwise, and map supported editing, paste, submit, and emergency-hide keys.
- [x] 8.3 Anchor fake content to the active cursor line, move it on selection changes, detect anchored-document mutations, and emergency-hide with a non-destructive warning.
- [x] 8.4 Make inline capture the primary command while retaining explicit native Comment and hidden-Webview fallbacks, then update documentation and release notes.
- [x] 8.5 Add focused model/surface/delegation safety tests, rerun strict OpenSpec and full extension validation, then rebuild and reinstall the local VSIX.

## 9. Inline-Capture IME Compatibility Fix

- [x] 9.1 Add a pure composition buffer and intercept `compositionStart`, `replacePreviousChar`, `compositionType`, and `compositionEnd` only while inline capture is active, delegating to `default:*` otherwise.
- [x] 9.2 Commit composed text exactly once without source-document edits or intermediate autosaves, and require both unfocused and inactive window state before automatic hiding.
- [x] 9.3 Add focused composition/state/delegation regressions, update documentation, rerun strict/full validation, then rebuild and reinstall the local VSIX.
