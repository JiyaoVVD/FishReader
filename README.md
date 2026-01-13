# 鱼阅(FishReader)

摸鱼看小说插件。

## Features

工作摸鱼用小说插件，支持在状态栏阅读，隐蔽程度1000%。

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

## Extension Settings

* `fishreader.defaultBookPath`: 小说文件路径（目前仅支持UTF-8编码的单个txt文件）

## Release Notes


### 0.0.1

Initial release of FishReader

---

## TODO:

