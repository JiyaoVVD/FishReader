## ADDED Requirements

### Requirement: Parser SHALL recognize extended chapter markers
The chapter-matching regex SHALL recognize the following markers in addition to existing ones: `终章`, `后记`, `尾声`, `番外`, `特典`.

#### Scenario: Line containing 终章
- **WHEN** a line matches the pattern `终章　在百花不开的落雪旷野`
- **THEN** the parser SHALL create a new chapter with title `终章 在百花不开的落雪旷野`

#### Scenario: Line containing 后记
- **WHEN** a line matches the pattern `后记`
- **THEN** the parser SHALL create a new chapter with title `后记`

#### Scenario: Line containing 番外
- **WHEN** a line matches the pattern `番外 夏日特别篇`
- **THEN** the parser SHALL create a new chapter with title `番外 夏日特别篇`

#### Scenario: Line containing 特典
- **WHEN** a line matches the pattern `特典 限定短篇`
- **THEN** the parser SHALL create a new chapter with title `特典 限定短篇`

#### Scenario: Line containing 尾声
- **WHEN** a line matches the pattern `尾声`
- **THEN** the parser SHALL create a new chapter with title `尾声`

### Requirement: Parser SHALL support extended chapter number ranges
The chapter number pattern SHALL support `百` and `千` in addition to existing characters, to match chapters like `第一百零一章`.

#### Scenario: Chapter with 百 in number
- **WHEN** a line contains `第一百章 新的开始`
- **THEN** the parser SHALL create a new chapter with title `第一百章 新的开始`
