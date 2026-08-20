# 鱼阅(FishReader)

摸鱼看小说插件。

## Features

工作摸鱼用小说插件，支持在状态栏阅读，隐蔽程度1000%。

现在也支持三种码字入口：实验性的内联捕获直接在当前文件行尾显示类似 CodeLens 的伪装注释；内联 Comment 是不拦截编辑器输入的原生后备；隐藏 Webview 则提供独立且更稳定的受控输入面。真实内容进入本地草稿，状态栏会短暂显示最近输入供校对。

[FishReader GitHub Repository](https://github.com/JiyaoVVD/FishReader)

## Guide

* 创建小说根目录并设置**小说文件路径**到目标目录,左侧工具栏会显示小说列表以及章节目录
* 目前仅支持读取txt文件，支持不同编码
* 章节目录采用正则表达式匹配形如 第xx章 的内容，部分小说可能不支持
* 小说内容显示在底部状态栏，默认显示20个字符，可以在 **设置-状态栏显示内容的长度** 中设置
* 默认切换窗口、切换文件、输入内容时会隐藏状态栏内容，被隐藏后可用Alt+;恢复显示。隐藏规则可以在设置中勾选。

## Shortcuts

* Alt+J : 上一章
* Alt+L : 下一章
* Alt+I : 上一行
* Alt+K : 下一行
* Alt+; : 显示内容
* Alt+' : 隐藏内容

码字命令默认不绑定快捷键，避免与编辑器和输入法冲突。命令面板中的名称统一以 `FishReader:` 开头：

* `FishReader: Start Inline Capture`：实验性主入口；在当前行尾显示低对比度伪装注释，不打开新标签页
* `FishReader: Start Inline Comment Writing`：在当前文件光标行展开原生 Comment 输入，作为不拦截按键的后备
* `FishReader: Start Hidden Webview Writing`：使用独立透明输入层，作为第三方输入法或键位扩展与内联捕获冲突时的稳定后备
* `FishReader: Resume Writing`：按上次选择的表面恢复当前草稿
* `FishReader: Emergency Hide Writing`：立即清除状态栏真实文本、关闭当前表面并请求保存
* `FishReader: Exit Writing Mode`：保存并恢复进入前的阅读状态栏
* `FishReader: New Draft`、`Select Draft`、`Rename Current Draft`
* `FishReader: Export Current Draft`：明确选择目标后导出 UTF-8 `.txt` 或 `.md`

## 隐秘码字说明

实验性的内联捕获模式会在当前光标行末尾绘制一段低对比度伪装代码/注释。普通输入进入草稿而不是源文件；Backspace/Delete 删除草稿末尾字符，Enter 提交当前段，Ctrl+V 或 Shift+Insert 粘贴，Esc 紧急隐藏。光标在同一文件内移动时，伪装注释会跟到新的当前行。状态栏仍按设置短暂显示最近真实文本。

FishReader 自身不会调用编辑器编辑 API，也不会把临时文字写入再撤回。内联捕获开启时会临时接管 VS Code 的 `type` 命令，并只在 `fishreader.inlineCaptureActive && editorTextFocus` 条件下覆盖常用编辑键；关闭后立即恢复为 `default:type`。如果其他命令、扩展或未覆盖快捷键改动了锚定文件，FishReader 会立即隐藏并警告，但不会自动执行撤销，以免破坏其他用户修改。请自行检查并在需要时撤销那次源文件编辑。

内联捕获会同时接管 VS Code 的普通 `type` 和完整 IME 组合命令序列。拼音及候选替换只存在于私有组合缓冲，选词结束后才把最终中文一次性提交到草稿；中间候选不会写入源文件或触发自动保存。IME 候选窗仅造成“未聚焦但仍活跃”时不会再自动中断，只有窗口同时未聚焦且不活跃才执行失焦隐藏。

这个入口仍属实验功能：第三方输入法、键位扩展和少见编辑命令仍可能存在冲突。遇到兼容性问题时，可使用 `FishReader: Start Hidden Webview Writing`。

内联 Comment 模式同样不会修改当前文件：Comment 中已提交的内容始终替换为本地内置的伪装代码，真实回复在点击 `Submit Draft` 后才进入草稿并显示在状态栏。受 VS Code Comment API 限制，回复框中尚未提交的真实文字是可见的，也不能被 FishReader 实时预览、自动保存或恢复；切换或隐藏前请先提交。

隐藏 Webview 模式适合需要更强视觉伪装的情况。真实输入控件和可见伪装代码分层处理：中文 IME、删除、粘贴和回车提交仍由真实控件接收，但界面绘制的是 TypeScript/JavaScript、Python、Lua、Markdown、JSON 或通用伪装模板。多行粘贴会保存完整行，只把最后一段留在当前单行中。

草稿正文位于 VS Code 为 FishReader 分配的 `globalStorageUri/drafts` 目录，索引元数据位于扩展 `globalState`。正常输入不会创建或修改工作区文件；只有执行导出并确认路径后，才会写入所选文件。上次活动草稿可在重启后恢复，保存冲突不会静默覆盖另一窗口的版本。

这项功能只提供视觉伪装，不是加密或安全沙箱。真实文字仍存在内存和本机草稿文件中，也无法防范管理员权限、其他恶意扩展、键盘记录、屏幕录制或本机存储检查。需要更低暴露时，可把状态栏预览长度设为 `0`。

## Extension Settings

* `fishreader.defaultBookPath`: 小说文件目录
* `fishreader.hideWhenInput`: 输入时隐藏状态栏内容
* `fishreader.hideWhenFocusOut`: 切换窗口时隐藏状态栏内容
* `fishreader.hideWhenSwitchEditor`: 切换文件时隐藏状态栏内容
* `fishreader.showLength`: 状态栏显示内容的长度
* `fishreader.writer.previewLength`: 状态栏最近真实文本长度，默认 20，设为 0 时禁用
* `fishreader.writer.previewTimeout`: 最近真实文本自动隐藏时间，默认 3000 毫秒
* `fishreader.writer.autosaveDebounce`: 停止输入后自动保存的等待时间，默认 400 毫秒
* `fishreader.writer.hideWhenFocusOut`: 码字界面不可见，或 VS Code 同时未聚焦且不活跃时紧急隐藏并请求保存

## Release Notes


### 0.0.1

Initial release of FishReader，新增本地隐秘码字、单行代码伪装、状态栏校对和草稿恢复能力。

---

## TODO

- 草稿历史版本和可选加密
