## Why

小说解析器在处理含有目录页的 TXT 文件时，会把目录中的章节标题也当作正文章节解析，产生大量空内容章节。同时，章节正文的第一行通常是空行，而 `StatusBarReader` 使用 JavaScript falsy 检查 (`!line`)，导致空行被误判为"无内容"，用户点击任何章节后状态栏均无法显示正文，也无法通过"下一行"前进。此外，章节正则缺少"终章"、"后记"、"特典"等常见标记，导致部分章节无法识别。

## What Changes

- 解析 TXT 时过滤掉纯空行，不将空行加入章节的 `content` 数组
- 解析完成后过滤掉内容为空的章节（目录区产生的空壳章节）
- `StatusBarReader` 中将 falsy 检查 (`!line`) 改为精确的 `undefined`/`null` 判断，支持空字符串作为合法行
- 章节匹配正则增加 `终章`、`后记`、`尾声`、`番外`、`特典` 等常见标记
- 修复 `getIndex` 方法中 `|| -1` 对索引 0 的误判，改为 `?? -1`

## Capabilities

### New Capabilities
- `empty-line-filtering`: 解析 TXT 时过滤空行和空章节，避免目录区产生空壳章节
- `extended-chapter-regex`: 扩展章节识别正则，支持终章、后记、尾声、番外、特典等

### Modified Capabilities

## Impact

- `src/novel_utils/txt.ts`: 修改章节正则、解析逻辑中添加空行过滤和空章节过滤
- `src/status_bar_reader.ts`: 修复 `refreshContent`、`nextLine`、`prevLine` 中的 falsy 检查
- `src/extension.ts`: 修复 `BookTreeDataProvider.getIndex` 和 `BookTreeItem.getIndex` 中的 `|| -1`
