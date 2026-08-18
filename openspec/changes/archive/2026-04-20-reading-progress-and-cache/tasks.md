## 1. StatusBarReader 位置接口

- [x] 1.1 在 `StatusBarReader` 中添加 `getPosition()` 方法，返回 `{ chapterIndex, lineIndex, contentIndex }`
- [x] 1.2 在 `StatusBarReader` 中添加 `setPosition()` 方法，接受 `{ chapterIndex, lineIndex, contentIndex }` 并恢复位置（含越界 clamp 逻辑）
- [x] 1.3 为 `getPosition` / `setPosition` 编写单元测试

## 2. 解析结果缓存

- [x] 2.1 新建 `src/novel_utils/book_cache.ts`，实现缓存工具函数：路径 hash 生成、缓存写入、缓存读取（含 fileSize + mtime 校验）
- [x] 2.2 修改 `novel_loader.ts` 的 `loadNovelFile`，在解析前检查缓存、解析后写入缓存
- [x] 2.3 在 `extension.ts` 的 `activate` 中将 `context.globalStorageUri` 传入缓存模块
- [x] 2.4 为缓存命中/未命中/失效场景编写单元测试

## 3. 阅读进度持久化

- [x] 3.1 在 `extension.ts` 中实现 `saveProgress(globalState, bookPath, position)` 和 `loadProgress(globalState, bookPath)` 辅助函数
- [x] 3.2 在所有翻页/切章命令回调中调用 `saveProgress`
- [x] 3.3 在 `openChapter` / `openBook` 命令中更新 `lastBook` 到 `globalState`
- [x] 3.4 为进度保存和加载编写单元测试

## 4. 启动恢复

- [x] 4.1 在 `activate()` 中读取 `lastBook` 和对应进度，若文件存在则加载书籍并调用 `setPosition` 恢复
- [x] 4.2 处理文件不存在或无进度数据的降级场景
- [x] 4.3 为启动恢复流程编写集成测试
