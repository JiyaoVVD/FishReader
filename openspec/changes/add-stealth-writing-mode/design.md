## Context

FishReader currently owns a single status-bar reading presentation and persists reading progress through VS Code extension storage. The new writing workflow must capture real text without showing it in the visible input surface, display a language-appropriate one-line code or comment decoy, expose a short real-text tail in the status bar for proofreading, and recover drafts after reloads.

The public VS Code comment and quick-input APIs cannot replace live user input with independently rendered text or inject an arbitrary native text field into an existing editor. The writing surface therefore needs a controlled Webview/custom-editor UI. This feature is visual camouflage for casual observation; it is not a security boundary against other extensions, administrators, screen capture, key loggers, or local storage inspection.

The existing reading-path stability findings remain separate implementation work. This change must not silently fix or redefine current reading requirements, but its architecture should avoid adding more unrelated state to `StatusBarReader` or the monolithic activation function.

One narrow activation prerequisite is included: when `defaultBookPath` is empty, activation must not turn that empty value into a drive-root scan. The writing feature is valid without a configured book library, and this guard is required for isolated extension-host tests and first-run writing mode. It does not change behavior for configured book paths.

## Goals / Non-Goals

**Goals:**

- Provide an explicit writing mode with a single-line, editor-like camouflage surface.
- Keep real input and visible camouflage text as separate data streams.
- Choose built-in camouflage templates from the active editor language and provide a neutral fallback.
- Preserve Chinese IME composition, deletion, paste, submit, and resume behavior.
- Show a configurable trailing real-text preview, character count, and truthful save state in the status bar.
- Autosave real drafts locally and recover the last active draft after extension or window restart.
- Preserve reading progress and restore the prior reading presentation after leaving writing mode.

**Non-Goals:**

- Injecting or styling private DOM nodes inside the native VS Code text editor.
- Modifying the user's active source file, its undo stack, or its selection to capture input.
- Intercepting editor typing outside an explicitly active experimental inline-capture session.
- Providing rich multi-line editing, outlines, formatting, version history, collaboration, or cloud sync in the initial release.
- Encrypting draft contents in the initial release.
- Claiming protection against privileged local observers or malicious extensions.

## Decisions

### 1. Use a controlled editor-group Webview for the camouflage surface

The extension will open a single writing Webview in the active editor group. The Webview will use VS Code theme tokens, editor typography, gutter spacing, and a one-line code layout so it blends with the workbench. A positioned one-row textarea remains focusable for keyboard and IME input, but its real glyphs and caret are not painted; a separate visible layer renders only the decoy prefix and a decoy caret.

The Webview sends real input state and lifecycle events to the extension host. It never sends decoy text to the draft repository.

Alternatives considered:

- Native quick input was rejected because its prominent top-center placement cannot be moved.
- Native comment threads were initially rejected as the only surface because the API cannot transform or autosave live reply text. They are now retained as an explicit inline fallback after the user prioritized staying in the current file over full live-input concealment.
- Edit-then-revert approaches remain rejected because they mutate the source file and undo stack. A tightly scoped `type` interception is now accepted only for the explicit experimental inline-capture mode described below.

### 2. Generate deterministic, language-aware decoy text locally

`CamouflageTemplateProvider` will map the active editor's `languageId` to a small built-in sequence of neutral code/comment templates. Initial mappings will cover TypeScript/JavaScript, Python, Lua, Markdown, JSON, and a generic comment fallback. No source code, draft text, network content, or generative service is used to construct templates.

The current uncommitted segment is counted in Unicode grapheme clusters. Each inserted grapheme advances one visible character through the active decoy template; deletion retracts it. When a template is exhausted, the renderer rotates to the next template and starts a new one-line prefix. Enter commits the real segment plus a newline, rotates the template, and clears the current input row. Multi-line paste commits complete pasted lines and retains the final partial line as the active segment.

This deterministic mapping makes deletion predictable, avoids splitting surrogate pairs or composed characters, and keeps real text structurally unrelated to the decoy.

### 3. Separate mode, session, presentation, and storage responsibilities

The runtime will be split into four responsibilities:

- `ModeController`: owns `reading` versus `writing` mode and the independently hidden/visible presentation state.
- `WriterSession`: owns the active draft ID, committed content, current segment, language ID, counts, and Webview message handling.
- `StatusBarPresenter`: renders either reading output or writing preview/save state and restores the previous presentation on mode exit.
- `DraftRepository`: owns local draft files, metadata, atomic saves, recovery, switching, and export.

Entering writing mode snapshots the active editor language and reading presentation without modifying reading position. Exiting or emergency hiding disposes the visible writing surface and returns control to `ModeController`; only a normal exit restores the reading presentation immediately, while emergency hide leaves all sensitive presentation hidden until explicit resume or mode exit.

### 4. Store bodies in global storage and metadata in global state

Each draft body will be written under `globalStorageUri/drafts/<draft-id>.txt`. A versioned draft index in `globalState` stores only metadata such as ID, title, timestamps, character count, and the active draft pointer. The current segment is part of the autosaved body so recovery does not depend on an Enter commit.

Saves are debounced after input changes and forced on segment commit, draft switch, hide, Webview disposal, and extension deactivation when possible. The repository writes a temporary sibling file and renames it over the destination to avoid exposing partially written drafts. Save completion or failure is returned to the session so the status bar never reports `saved` before persistence succeeds.

Draft files remain outside the workspace unless the user invokes export. Export uses an explicit save dialog and writes UTF-8 TXT or Markdown without changing the internal draft location.

### 5. Keep status preview useful but ephemeral

While the writing surface is active, the status bar displays the last configured number of real grapheme clusters, total character count, and save state. Newlines are rendered as `↵`. The default preview length is 20 and the default idle timeout is 3000 ms. After the timeout, only count and save state remain; a preview length of zero disables real-text preview entirely.

The existing show/hide commands become mode-aware: they reveal or conceal the active mode's presentation without changing stored content. Emergency hide has stronger semantics: it immediately clears the real-text preview, disposes the writing surface, requests a forced save, and retains the active draft for explicit resume.

### 6. Make privacy and failure states explicit

The UI and documentation will describe the feature as visual camouflage, not encryption. If autosave fails, the session retains the in-memory buffer, displays a visible failure state, and retries on the next save trigger. Emergency hide prioritizes clearing visible real text even if persistence fails; the failure is reported without re-exposing the preview.

### 7. Add a native inline Comment fallback without intercepting editor typing

`FishReader: Start Inline Comment Writing` becomes the current-file entry point when a text editor is active. It creates an expanded VS Code `CommentThread` at the active cursor line, uses a language-aware fake code/comment body and placeholder, and accepts text through the native reply editor. Submitting the reply commits the real text to `WriterSession`, immediately saves it, and replaces visible submitted content with another fake comment. The active source document is never edited.

The Comment API cannot replace or observe reply text while the user is typing. Real unsubmitted text is therefore visible in the native reply box, is not reflected in the status bar, and cannot be autosaved or recovered until submission. This limitation is surfaced in command naming, settings, and README. `FishReader: Start Hidden Webview Writing` remains available when concealing live text, per-keystroke status preview, and uncommitted autosave matter more than staying inside the current file. If inline mode starts without an active text editor, the controller falls back to the Webview rather than creating or modifying a file.

The command palette uses English names beginning with `FishReader:`. Existing `fishreader.*` command identifiers remain stable so user-defined keybindings continue to work.

### 8. Add an experimental decoration-based inline-capture surface

`FishReader: Start Inline Capture` becomes the primary current-file experiment. It anchors a documented `TextEditorDecorationType` at the end of the active cursor line and renders only the current language's fake code/comment prefix. The decoration is presentation-only: the implementation does not call `TextEditor.edit`, create a `WorkspaceEdit`, change the source selection, or participate in the source document undo stack.

While this surface is active, the extension sets the `fishreader.inlineCaptureActive` context key and intercepts the documented `type` command. Typed text is appended to `WriterSession`; outside that context the handler delegates immediately to `default:type`. Narrow keybindings capture Backspace, Delete, Enter, paste, and Escape only when both `fishreader.inlineCaptureActive` and `editorTextFocus` are true. Editing commands that could mutate the source unexpectedly, including cut, undo, redo, indentation, and line insertion, are consumed during the experiment.

Windows IME does not use only `type`: VS Code routes composition through `compositionStart`, `replacePreviousChar` or `compositionType`, and `compositionEnd`. Inline capture therefore intercepts that complete sequence while active and delegates to the corresponding `default:*` commands otherwise. A private composition buffer applies the same UTF-16 replacement counts and cursor delta carried by VS Code, but does not update `WriterSession`, status preview, autosave, decoration source, or the editor document until `compositionEnd`. The final composed value is committed exactly once; cancelling or hiding clears the private composition buffer.

The surface records the anchored document URI and version when it opens. Any text-document change for that URI is treated as a safety violation: FishReader immediately hides the surface, clears the preview, requests a save, and warns the user to review or undo the external edit. The guard detects but does not automatically revert changes, because an automatic undo could destroy unrelated user work. Cursor movement within the same editor merely moves the decoration to the new active line.

VS Code window state exposes both `focused` and `active`. An IME candidate window may cause a focus-only transition while the editor window is still actively receiving interaction, so automatic focus-loss hiding is applied only when both values are false. Explicit Escape hiding remains immediate. This mode remains experimental because composition commands, extension conflicts around typing, and unmapped editing chords vary by platform and keymap. The hidden Webview remains the stable fallback; the native Comment command remains available as a non-intercepting current-file fallback.

## Risks / Trade-offs

- [Webview styling can drift from VS Code themes] -> Use documented theme color variables and test representative light, dark, and high-contrast themes.
- [Transparent input can break IME candidate placement or accessibility] -> Keep the textarea positioned on the visible row, handle composition events explicitly, provide an accessible label, and include Windows Chinese IME manual acceptance.
- [Status preview itself can expose text] -> Limit by grapheme count, hide after an idle timeout, support zero-length preview, and clear immediately on focus-loss policy or emergency hide.
- [Debounced saves can lose the last few characters during a hard process termination] -> Save frequently, force saves on all observable lifecycle boundaries, and never discard the in-memory segment after a failed write.
- [Rewriting a large draft on every debounce can become expensive] -> Keep the first version simple, measure representative large drafts, and move to append/checkpoint storage only if profiling shows a problem.
- [Two VS Code windows can edit one draft concurrently] -> Detect metadata revision or timestamp conflicts and refuse silent last-writer overwrite; full merge support is out of scope.
- [Camouflage can be mistaken for a security feature] -> Document the threat-model boundary in settings, README, and the writing-mode entry description.
- [Inline Comment input exposes unsubmitted real text] -> Keep it explicitly labeled; store only on submit, never render submitted real text as a comment, and retain the hidden Webview command for stricter concealment.
- [Inline `type` interception can conflict with IMEs, keymaps, or other extensions] -> Scope it behind `fishreader.inlineCaptureActive`, delegate to `default:type` otherwise, consume common mutating chords, detect anchored-document changes, and retain Webview/Comment fallbacks.
- [IME uses composition commands that bypass `type`] -> Intercept the complete composition command sequence only while inline capture is active, apply replacement counts in a private buffer, and commit once on composition end.
- [IME candidate UI can cause a focus-only window-state transition] -> Require both `focused === false` and `active === false` before automatic focus-loss hiding; keep Escape as the immediate manual path.
- [An unmapped command can still edit the anchored source document] -> Never perform source edits from FishReader; monitor the document version and emergency-hide with a warning on any change instead of attempting a destructive automatic undo.

## Migration Plan

The feature is additive and disabled until the user invokes a writing command. Existing book caches, settings, and reading-progress keys require no migration. Draft storage uses its own versioned namespace so the feature can be rolled back without touching reading data; uninstalling or rolling back the extension leaves draft files in global storage for a future compatible version or manual recovery.

Implementation will land behind its own commands and context keys, followed by automated storage/session tests and a manual Webview/IME acceptance pass before packaging.

## Open Questions

- The initial command may ship without a default keybinding to avoid conflicts; a default can be selected after testing common Windows layouts.
- The exact editor-tab title and built-in decoy template wording should be validated visually, but neither choice changes the behavioral contract.
