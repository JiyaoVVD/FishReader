## Why

大型 txt 文件（数 MB）首次打开时需要完整读取、编码检测、逐行正则匹配，导致解析耗时明显。同时，用户关闭 VS Code 后再次打开，无法恢复到上次阅读的位置，需要手动重新定位章节和行号，体验较差。

## What Changes

- 新增解析结果缓存机制：首次解析后将章节结构序列化存储到 `globalStorageUri` 目录下的 JSON 文件，后续打开同一文件时通过文件大小+修改时间校验缓存有效性，命中则跳过解析直接加载
- 新增阅读进度持久化：利用 `ExtensionContext.globalState` 存储每本书的阅读进度（章节索引、行索引、行内偏移），以及最近打开的书籍路径
- 扩展激活时自动恢复上次阅读位置

## Capabilities

### New Capabilities
- `book-parse-cache`: 将 txt 文件的解析结果（章节结构和内容）缓存到本地文件，避免重复解析大文件
- `reading-progress-persistence`: 持久化存储用户的阅读进度，支持重启后自动恢复阅读位置

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- `src/novel_utils/txt.ts` — readBook 需要对接缓存的读写逻辑
- `src/novel_utils/novel_loader.ts` — loadNovelFile 需要优先检查缓存
- `src/status_bar_reader.ts` — 需要暴露/接受阅读位置的序列化/反序列化，新增 `setPosition()` 方法
- `src/extension.ts` — activate 中增加进度恢复流程，命令回调中增加进度保存调用
- 新增依赖：无（使用 VS Code 内置 API）
