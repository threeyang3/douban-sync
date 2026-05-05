---
title: 开发计划
nav_order: 900
---

# 开发计划

当前分支为 `adv`，下一阶段围绕配置迁移、模板易用性和同步替换安全性展开。

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

## 建议提交顺序

1. `feat: add custom property import and export`
2. `feat: add built-in template presets`
3. `feat: inherit existing note metadata during forced sync`
4. `docs: document configuration import and sync inheritance`
