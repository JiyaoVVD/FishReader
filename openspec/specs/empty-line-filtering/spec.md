## Purpose

Ensure TXT parsing ignores empty content and does not expose chapters that contain no readable body text.

## Requirements

### Requirement: Empty lines SHALL be filtered during parsing
The TXT parser SHALL NOT include empty lines (lines where `trim()` produces an empty string) in a chapter's `content` array.

#### Scenario: Chapter with leading empty lines
- **WHEN** a chapter title is followed by one or more empty lines before the first paragraph
- **THEN** the chapter's `content` array SHALL start with the first non-empty line

#### Scenario: Chapter with interspersed empty lines
- **WHEN** a chapter contains paragraphs separated by empty lines
- **THEN** the chapter's `content` array SHALL contain only the non-empty lines, preserving their order

### Requirement: Empty chapters SHALL be filtered after parsing
The TXT parser SHALL NOT return chapters whose `content` array is empty or undefined after parsing.

#### Scenario: Table-of-contents chapter titles
- **WHEN** a TXT file contains a table of contents section where chapter titles appear with no body text between them
- **THEN** the parsed result SHALL NOT contain those empty chapters

#### Scenario: All chapters with content are preserved
- **WHEN** a TXT file contains chapters that have actual body text
- **THEN** all such chapters SHALL appear in the parsed result with their content intact
