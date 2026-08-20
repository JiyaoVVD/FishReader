# Change Log

All notable changes to the "fishreader" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- 新增单行编辑器风格的隐秘码字界面，以本地语言模板显示伪装注释或代码。
- 新增状态栏最近真实输入、字符数、保存状态和超时隐藏。
- 新增本地草稿自动保存、恢复、选择、重命名、冲突保护和 UTF-8 TXT/Markdown 导出。
- 新增紧急隐藏与失焦隐藏；写作模式下隔离原有阅读位置和导航快捷键。
- 空的 `fishreader.defaultBookPath` 不再触发驱动器根目录扫描。
- 明确隐秘码字只提供视觉伪装，不提供加密或对抗本机特权观察者。
- 新增当前文件内联 Comment 入口：评论附着在光标行，提交后只显示伪装代码且不修改源文件；隐藏 Webview 入口继续保留。
- 新增实验性的当前编辑器内联捕获：在光标行尾绘制低对比度伪装注释，显式启用期间将普通输入写入草稿，并监测源文件意外变更。
- 修复内联捕获的 Windows 中文 IME 中断：接管完整组合命令序列，在私有缓冲中处理候选替换，并仅在组合结束时一次性提交最终文字。
- 失焦隐藏现在同时检查 VS Code 的 `focused` 与 `active` 状态，IME 候选窗造成的短暂焦点切换不会关闭码字会话。
- 保留原生 Comment 与隐藏 Webview 入口，分别作为不拦截编辑器输入和中文 IME/稳定隐藏的后备方案。
- 命令面板标题统一改为英文 `FishReader:` 前缀，现有 `fishreader.*` 命令 ID 保持不变。
