## Context

FishReader 是一个 VS Code 扩展，在状态栏中逐行展示小说内容。当前架构：

- `novel_loader.ts` + `txt.ts`：读取文件 → 编码检测 → 全文按行分割 → 正则匹配章节标题 → 构造 `BookContentTree`
- `StatusBarReader`：维护 `chapterIndex / lineIndex / contentIndex` 三个游标控制阅读位置
- `extension.ts`：在 `activate()` 中加载目录、注册命令，所有状态都在内存中

问题：大文件（>2MB）首次解析慢；关闭 VS Code 后所有阅读进度丢失。

## Goals / Non-Goals

**Goals:**
- 大文件二次打开时跳过解析，直接从缓存加载章节数据
- 持久化每本书的阅读进度，重启后自动恢复
- 缓存失效时（文件被修改）自动回退到全量解析

**Non-Goals:**
- 不做流式/分块解析（复杂度高，缓存方案已足够）
- 不做多设备进度同步
- 不做书签/多进度记录（只记最近一个位置）

## Decisions

### 1. 缓存存储位置：`globalStorageUri` 目录下的 JSON 文件

**选择**：每本书一个 JSON 文件，存在 `context.globalStorageUri` 下。
**替代**：`globalState`（有隐式大小限制，不适合存大文件的完整章节内容）、`workspaceState`（和 workspace 绑定，换 workspace 后丢失）。
**理由**：globalStorageUri 是扩展专属文件系统目录，无大小限制，可以存完整的 BookContentTree 序列化数据。

### 2. 缓存校验策略：文件大小 + mtime

**选择**：用 `{ filePath, fileSize, mtime }` 作为缓存有效性判断。
**替代**：文件内容 hash（准确但对大文件计算慢，违背缓存初衷）。
**理由**：size + mtime 在绝大多数场景下足以检测文件变更，且零额外开销。

### 3. 缓存文件命名：路径 hash

**选择**：对书籍文件的绝对路径做简单 hash（如取 base64 或 MD5），作为缓存 JSON 文件名。
**理由**：避免路径中特殊字符导致的文件名问题。

### 4. 阅读进度存储位置：`globalState`

**选择**：用 `context.globalState` 存储（key-value 形式）。
**理由**：进度数据极小（每本书约 100 bytes），globalState 完全够用，且 VS Code 自动管理持久化。

数据结构：
```typescript
// key: `progress:${bookPath}`
interface ReadingProgress {
  chapterIndex: number;
  lineIndex: number;
  contentIndex: number;
}

// key: `lastBook`
// value: string (书籍 BookContentTree 对应的路径标识)
```

### 5. 进度保存时机：每次翻页/切章时

**选择**：在 `nextLine / prevLine / nextChapter / prevChapter / setChapter / openChapter` 等操作后保存。
**替代**：定时保存（复杂且不可靠）、关闭时保存（VS Code 扩展没有可靠的 deactivate 保证）。
**理由**：globalState.update 是异步但几乎无开销的操作，每次操作都保存最简单可靠。

### 6. 架构方式：在 extension.ts 中协调缓存和进度

**选择**：不引入独立的 PersistenceManager 类，直接在 `extension.ts` 中用几个辅助函数处理缓存读写和进度存取。`StatusBarReader` 新增 `getPosition()` / `setPosition()` 方法暴露和恢复阅读位置。
**理由**：项目规模小，独立管理器过度设计。缓存和进度逻辑直接写在 extension 层即可。

## Risks / Trade-offs

- **[缓存膨胀]** 用户打开大量不同书籍会积累缓存文件 → 可后续加 LRU 清理，当前不处理
- **[mtime 欺骗]** 复制文件可能保留 mtime 导致错误命中缓存 → 极低概率，可接受
- **[globalState 丢失]** VS Code 理论上可能清理 globalState → 仅丢失进度，不影响功能，可重新定位
