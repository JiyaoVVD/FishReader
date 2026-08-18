## 1. TXT 解析器修复

- [x] 1.1 扩展 `txt.ts` 中的章节匹配正则，增加 `终章|后记|尾声|番外|特典` 和数字中的 `百|千`
- [x] 1.2 在 `contentBuffer.push(line)` 前添加 `if (line.trim())` 过滤空行
- [x] 1.3 在 `readBook()` 返回前过滤掉 `content` 为空或 `undefined` 的章节

## 2. StatusBarReader 修复

- [x] 2.1 修复 `refreshContent()` 中 `if (!line)` 为精确的 undefined/null 检查
- [x] 2.2 修复 `nextLine()` 中 `if (!line) return` 为精确的 undefined/null 检查
- [x] 2.3 修复 `prevLine()` 中同样的 falsy 检查问题

## 3. getIndex 修复

- [x] 3.1 修复 `BookTreeDataProvider.getIndex` 中 `|| -1` 为 `?? -1`
- [x] 3.2 修复 `BookTreeItem.getIndex` 中 `|| -1` 为 `?? -1`

## 4. 验证

- [x] 4.1 使用含有目录页的 TXT 文件验证解析结果无空壳章节
- [x] 4.2 验证终章、后记等章节能被正确识别
- [x] 4.3 验证点击章节后状态栏能正确显示正文
