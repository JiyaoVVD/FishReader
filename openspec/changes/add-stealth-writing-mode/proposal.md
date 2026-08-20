## Why

FishReader currently supports discreet reading but has no matching way to capture writing without exposing the real draft in a prominent editor or quick-input overlay. A stealth writing mode can extend the product's core discreet-workflow value while keeping the real text locally recoverable and available for short status-bar proofreading.

## What Changes

- Add an explicit writing mode alongside the existing reading mode, with commands to start, submit, hide, resume, and exit a writing session.
- Present a single-line, editor-like camouflage surface that displays language-aware comment or code templates instead of the real draft text.
- Advance and retract the visible camouflage text in response to real typing and deletion while keeping the actual input in a separate draft buffer.
- Show a configurable trailing preview of the most recently entered real text in the status bar for proofreading, with idle-time hiding and an immediate emergency-hide action.
- Persist draft content locally with debounced autosave, committed-segment save points, crash recovery, and basic draft selection and export operations.
- Keep writing state and storage separate from book-reading state so entering or leaving writing mode does not alter reading progress.
- Add a native inline Comment mode for writing directly against the active file without opening another editor tab, while retaining the Webview mode for fully concealed live input.
- Add an experimental current-editor inline-capture mode that intercepts typing only while explicitly active and renders a fake line-end annotation without editing the source document.
- Preserve Windows Chinese IME composition in inline capture by handling VS Code's composition command sequence and ignoring focus-only transitions while the window remains actively used.
- Present writing commands in the command palette with English `FishReader:`-prefixed names while keeping stable `fishreader.*` command identifiers.

## Capabilities

### New Capabilities

- `stealth-writing-session`: Defines writing-mode lifecycle, the single-line language-aware camouflage display, real-text status-bar preview, reader/writer mode separation, and emergency hiding.
- `writing-draft-persistence`: Defines local draft storage, autosave, recovery, draft switching, and explicit TXT/Markdown export behavior.

### Modified Capabilities

None. Existing reading and parsing requirements remain unchanged.

## Impact

- Adds VS Code commands, keybindings, settings, context keys, a custom editor/Webview-based writing surface, an experimental decoration-based inline-capture surface, and an optional native Comment surface.
- Adds writing-session, camouflage-template, status-preview, and draft-repository modules instead of extending `StatusBarReader` with unrelated responsibilities.
- Uses VS Code `globalStorageUri` for draft bodies and `globalState` only for draft metadata and active-session pointers.
- Requires focused extension-host and Webview interaction tests, storage/recovery tests, and regressions proving reading progress is unaffected.
- Does not require cloud services or new runtime dependencies for the initial version.
