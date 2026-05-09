---
title: 开发计划
nav_order: 900
---

# 开发计划

当前分支为 `adv`。`1.2.0` 已完成，以下条目保留为已交付记录。

## 1. 自定义属性导出、导入

目标：让用户可以备份、迁移和复用自定义属性配置。

涉及模块：
- `src/org/wanxp/douban/setting/CustomPropertySettingsHelper.ts`
- `src/org/wanxp/douban/setting/model/CustomProperty.ts`
- `src/org/wanxp/lang/locale/zh-cn.ts`
- `src/org/wanxp/lang/locale/en.ts`

计划：
- 在自定义属性设置区增加导出和导入按钮。
- 导出 JSON，包含格式版本和 `customProperties` 数组。
- 导入时校验 JSON 结构、字段完整性和 `SupportType` 映射。
- 支持覆盖导入和合并导入；合并时按 `name + field` 去重。

验收：
- 导出的 JSON 可以完整恢复当前配置。
- 错误 JSON 不会污染现有设置。
- 中英文 UI 文案完整。

状态：已完成（2026-05-05）

## 2. 内置模板

目标：减少新用户手动复制默认模板、创建模板文件、再选择路径的步骤。

涉及模块：
- `src/org/wanxp/constant/DefaultTemplateContent.ts`
- `src/org/wanxp/douban/setting/TemplateSettingHelper.ts`
- `src/org/wanxp/douban/component/DoubanSyncModal.ts`
- `src/org/wanxp/lang/locale/zh-cn.ts`
- `src/org/wanxp/lang/locale/en.ts`

计划：
- 将现有默认模板整理为内置模板预设。
- 第一版提供基础模板、简洁模板、同步模板。
- 在模板设置区提供复制模板和写入模板文件能力。
- 写入文件前检查是否已存在，存在时要求确认。

验收：
- 用户可以一键生成模板文件。
- 不会静默覆盖已有模板。
- 生成模板的 frontmatter 可被现有同步和导入流程正常解析。

状态：已完成（2026-05-05）

## 3. 替换同步条目时继承原笔记数据

目标：开启替换同步时，保留用户在旧笔记中手工维护的字段。

涉及模块：
- `src/org/wanxp/douban/sync/handler/DoubanAbstractSyncHandler.ts`
- `src/org/wanxp/douban/sync/model/SyncStatusHolder.ts`
- `src/org/wanxp/douban/sync/model/SyncConfig.ts`
- `src/org/wanxp/douban/component/DoubanSyncModal.ts`
- `src/org/wanxp/utils/YamlUtil.ts`
- `src/org/wanxp/utils/VariableUtil.ts`

计划：
- 增加同步配置项：是否继承旧数据、继承字段列表。
- 第一版只继承旧笔记 frontmatter 指定字段，正文继承后置。
- 复用 `SyncStatusHolder` 的本地文件索引，按 `doubanId` 找到旧文件。
- 合并策略保持明确：同步生成字段优先，用户指定继承字段从旧文件补入。
- 默认继承字段建议为 `tags, aliases`。

验收：
- 未开启继承时替换逻辑保持现状。
- 开启继承后，旧文件指定 frontmatter 字段进入新文件。
- 同步失败不会删除或污染旧文件。
- 覆盖 `force=false`、`force=true + inherit=false`、`force=true + inherit=true` 三类场景。

状态：已完成（2026-05-05）

## 4. 用户数据导出/导入/继承

目标：让用户可以备份、迁移和复用自定义数据（自定义属性 + 正文分区），并在强制同步时自动保护这些数据。

涉及模块：
- `src/org/wanxp/douban/userdata/types.ts` — 类型定义、DOUBAN_FIELDS 排除集
- `src/org/wanxp/douban/userdata/UserDataExtractor.ts` — 从本地文件提取用户数据
- `src/org/wanxp/douban/userdata/UserDataExporter.ts` — 按条目类型分组导出 JSON
- `src/org/wanxp/douban/userdata/UserDataImporter.ts` — 从 JSON 导入，支持三种合并策略
- `src/org/wanxp/douban/userdata/UserDataMerger.ts` — frontmatter 字段和正文分区合并
- `src/org/wanxp/douban/userdata/UserDataModal.ts` — 导出/导入/缺失字段/结果 UI
- `src/org/wanxp/utils/VaultUtil.ts` — 共享 Vault 扫描工具
- `src/org/wanxp/main.ts` — 命令注册 + 强制同步数据保护集成

计划：
- 导出：扫描文件夹中含 doubanId 的 .md 文件，提取非标准 frontmatter 字段和正文分区，按类型输出 JSON
- 导入：按 doubanId 匹配本地文件，支持智能/本地优先/导入优先三种合并策略
- 缺失字段：导入数据中存在但本地 frontmatter 中没有的字段，逐条询问用户是否添加
- 数据保护：强制同步替换文件时，自动提取旧文件的用户数据并合并到新文件
- 共享 VaultUtil：多个模块复用同一个 `scanVaultForDoubanIds()` 避免重复扫描

验收：
- 导出的 JSON 可以完整恢复用户的自定义数据
- 三种合并策略行为正确
- 强制同步后用户的自定义属性、记录、感想分区不丢失
- 数据保护开关可独立控制
- 中英文 UI 文案完整

状态：已完成（2026-05-05）

## 5. 模板设置重构 + Bug 修复

目标：简化模板设置 UI，修复 tags 混入类型问题，为内置模板添加封面链接属性。

涉及模块：
- `src/org/wanxp/douban/setting/TemplateSettingHelper.ts` — 模板设置 UI 重写
- `src/org/wanxp/douban/setting/model/DoubanPluginSetting.ts` — TemplateConfig 数据模型
- `src/org/wanxp/douban/component/TemplateEditorModal.ts` — 模板编辑/预览模态框
- `src/org/wanxp/douban/data/handler/DoubanAbstractLoadHandler.ts` — tags 修复 + getTemplate 适配
- `src/org/wanxp/constant/DefaultTemplateContent.ts` — 模板添加封面链接、删除冗余 tags
- `src/org/wanxp/douban/setting/TemplatePresetUtil.ts` — compact 模板同步更新
- `src/org/wanxp/main.ts` — 设置迁移逻辑

计划：
- tags 修复：`parseUserInfo` 不再将 `extract.type` 注入 `myTags`
- 模板封面链接：所有内置模板 frontmatter 添加 `image: {{imageData.url}}`
- 模板设置 UI：每类模板一行 dropdown（内置/文件/自定义）+ 上下文按钮 + 复制按钮
- 模板编辑器：支持预览（只读）和编辑（自定义内容）两种模式
- 设置迁移：旧 `xxxTemplateFile` 自动迁移到 `TemplateConfig`

验收：
- tags 不再包含 "book"/"movie" 等类型标签
- 内置模板 frontmatter 含 `image: {{imageData.url}}`
- 模板设置 UI 简洁，每行只有 dropdown + 上下文按钮 + 复制按钮
- 旧用户设置自动迁移，无需手动操作
- 构建无报错

状态：已完成（2026-05-06）

## 6. 用户数据导入预览重构

目标：导入前提供可视化预览，支持条目选择、属性管理和逐字段策略控制。

涉及模块：
- `src/org/wanxp/douban/userdata/ImportPreviewModal.ts` — 三步预览模态框
- `src/org/wanxp/douban/userdata/UserDataImporter.ts` — 差异构建（buildDiffs）+ 执行导入（applyDiffs）
- `src/org/wanxp/douban/userdata/types.ts` — ImportAttributeSettings、FieldDiff、EntryDiff 类型

计划：
- 三步流程：条目总览 → 字段差异对比 → 导入结果
- 条目勾选框 + 全选/全不选，控制哪些条目进入差异对比
- 属性管理面板：逐属性设置保持对比/忽略/别名为（自由文本输入）
- smart_merge 字符串拼接（local / import），数组去重合并
- 跳过相同值和本地有值但导入为空的字段

验收：
- 模态框宽度足够阅读密集内容
- 属性管理可正确忽略字段和映射别名
- smart_merge 字符串字段正确拼接
- 勾选框联动正常

状态：已完成（2026-05-10）

## 后续建议

1. 为 `1.2.0` / `1.4.0` / `1.5.0` 新功能补充文档截图
2. 为自定义属性导入导出补测试
3. 为用户数据导出/导入补单元测试
4. 为同步继承补更多 frontmatter 边界测试
