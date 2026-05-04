# Pull Request 说明

## 概述

本 PR 修复了多项问题并优化了功能，主要涉及语言设置、简介获取、同步检测等方面。

## 修改内容

### 1. 语言跟随系统设置
- **问题**：插件语言无法正确跟随 Obsidian 的语言设置
- **原因**：原代码使用 `localStorage.getItem('language')` 获取语言，但这种方式在某些情况下不可靠
- **解决**：改用 `moment.locale()` 获取语言设置，因为 Obsidian 会配置 moment 的语言
- **修改文件**：`src/org/wanxp/lang/helper.ts`

### 2. 简介内容获取优化
- **问题**：
  - 图书简介可能获取到"作者简介"而非"内容简介"
  - 部分条目简介存在折叠内容重复的问题
- **解决**：
  - 图书：通过 `<h2>内容简介</h2>` 精确定位内容简介部分
  - 电影/电视剧/音乐/游戏：获取所有简介元素，选择最长的（完整版）
- **修改文件**：`DoubanBookLoadHandler.ts`、`DoubanMovieLoadHandler.ts` 等

### 3. 同步功能增强
- **问题**：
  - 当文件名模板改变时，无法识别已同步的条目，导致重复创建
  - "替换同名文档"功能无法根据 doubanId 删除旧文件
- **解决**：
  - 基于 `doubanId` 检测本地已存在文件（检查 frontmatter）
  - 预构建本地文件索引，提升检测效率
  - 开启"替换同名文档"时，根据 doubanId 删除旧文件后创建新文件
- **修改文件**：`SyncStatusHolder.ts`、`DoubanAbstractSyncHandler.ts`、`main.ts`

### 4. 结果文件链接优化
- **问题**：同步结果文件中的链接使用简单的 title 生成，不考虑实际命名规则
- **解决**：使用实际生成的文件名创建链接
- **修改文件**：`SyncHandler.ts`、`SyncItemResult.ts`

### 5. desc 字段 YAML 处理
- **问题**：多行简介在 YAML frontmatter 中处理不当
- **解决**：新增 `handleMultiLineText()` 方法处理多行文本
- **修改文件**：`YamlUtil.ts`、`VariableUtil.ts`

## 测试情况

- TypeScript 编译通过
- 功能测试：
  - 语言跟随系统设置
  - 图书简介正确获取"内容简介"
  - 同步时检测已存在文件
  - "替换同名文档"功能正常工作

## 兼容性

- 不影响现有功能
- 不改变数据结构
- 向后兼容

## PR 标题

```
fix: 修复语言跟随系统、简介获取、同步重复检测等多项问题
```
