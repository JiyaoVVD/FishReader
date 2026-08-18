## ADDED Requirements

### Requirement: Cache book parse results to local file
The system SHALL serialize the parsed `BookContentTree` (including all chapter titles and content) to a JSON file under `globalStorageUri` after the first successful parse of a txt file.

#### Scenario: First-time parse creates cache
- **WHEN** a txt file is parsed for the first time (no cache exists)
- **THEN** the system SHALL write the parsed BookContentTree to a JSON cache file named by a hash of the source file's absolute path

#### Scenario: Cache file includes validation metadata
- **WHEN** a cache file is written
- **THEN** the file SHALL include the source file's absolute path, file size (bytes), and last modification time (mtime) alongside the serialized BookContentTree

### Requirement: Load from cache when valid
The system SHALL check for a matching cache file before performing a full parse. If a valid cache exists, the system SHALL load the BookContentTree from cache and skip the parse.

#### Scenario: Cache hit with matching metadata
- **WHEN** a txt file is opened AND a cache file exists with matching filePath, fileSize, and mtime
- **THEN** the system SHALL load the BookContentTree from the cache file without reading or parsing the source txt file

#### Scenario: Cache miss due to changed file size
- **WHEN** a txt file is opened AND a cache file exists but the file size differs from the source file
- **THEN** the system SHALL ignore the cache and perform a full parse, then overwrite the cache

#### Scenario: Cache miss due to changed mtime
- **WHEN** a txt file is opened AND a cache file exists but the mtime differs from the source file
- **THEN** the system SHALL ignore the cache and perform a full parse, then overwrite the cache

#### Scenario: No cache file exists
- **WHEN** a txt file is opened AND no cache file exists for that path
- **THEN** the system SHALL perform a full parse and create a new cache file

### Requirement: Cache file naming uses path hash
The system SHALL derive the cache file name from a hash of the source file's absolute path to avoid filesystem-unsafe characters.

#### Scenario: Different files produce different cache names
- **WHEN** two txt files with different absolute paths are cached
- **THEN** they SHALL produce distinct cache file names

#### Scenario: Same file always produces same cache name
- **WHEN** the same txt file is cached on multiple occasions
- **THEN** it SHALL always map to the same cache file name
