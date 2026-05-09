# douban-sync

Obsidian 插件，从豆瓣导入电影、书籍、音乐、电视剧、日记、游戏数据到 Obsidian 笔记。

## 当前仓库状态

- 当前主仓库：`https://github.com/threeyang3/douban-sync`
- 当前开发分支：`adv`
- 当前版本基线：`2.1.5`
- `origin` 指向 `douban-sync`；旧远端保留为 `obsidian-douban`
- 对外 README 和 `doc/` 已移除原项目个人化内容，只保留插件本身介绍与使用说明
- 所有开发和修改默认在 `adv` 分支进行，**除非用户明确要求，否则绝不合并到 `main` 分支**

## 技术栈

- TypeScript + esbuild
- Obsidian Plugin API
- Cheerio（HTML 解析）、moment（日期）、schema-dts（JSON-LD）
- Jest（测试）、VitePress（文档站）

## 项目结构

```
src/org/wanxp/
├── constant/          # 常量、默认设置、模板内容
├── douban/
│   ├── ai/handler/    # AI 分析 handler
│   ├── component/     # UI 组件（模态框、日期选择等）
│   ├── data/handler/  # 各类型数据加载 handler（Book/Movie/Music/Teleplay/Game）
│   ├── model/         # 数据模型
│   ├── sync/          # 同步逻辑（handler/model/component）
│   └── userdata/      # 用户数据导出/导入/合并（Extractor/Exporter/Importer/Merger）
├── lang/              # 多语言支持
├── utils/             # 工具类（YamlUtil、VariableUtil、VaultUtil 等）
└── main.ts            # 插件入口
```

## 常用命令

```bash
npm install            # 安装依赖
npm run build          # TypeScript 检查 + esbuild 生产构建
npm run dev            # 开发模式（watch）
npm run test           # Jest 测试
npm run docs:dev       # VitePress 文档站本地开发
npm run docs:build     # 文档站构建
```

## 文档站

文档源码在 `doc/` 目录，使用 VitePress。

## 关键约定

- 版本号同步修改 `package.json`、`package-lock.json`、`manifest.json` 和 `versions.json`
- 发布 GitHub Release 时标签不带 `v` 前缀，仅数字（如 `2.0.0`）
- 发布 GitHub Release 时必须上传 `main.js`、`manifest.json`、`styles.css` 三个文件作为 release assets
- 各类型数据 handler 继承 `DoubanAbstractLoadHandler`，同步 handler 继承 `DoubanAbstractSyncHandler`
- 同步列表 handler 通过 `DoubanAbstractListHandler.create(syncType, doType)` 工厂方法创建，不再需要叶子类文件
- 路径自动补全使用 `PathSuggest`（mode: 'folder' | 'file'），替代原 FolderSuggest/FileSuggest
- 模板变量定义在 `DefaultTemplateContent.ts`，解析在 `VariableUtil.ts`
- 模板中变量用 `[[ ]]` 包裹为 wiki link 时，必须用双引号括起来（如 `"[[{{image}}]]"`），否则 `[` 被 YAML 特殊字符处理会多出一层引号
- YAML frontmatter 生成在 `YamlUtil.ts`，多行文本使用 `handleMultiLineText()`
- 语言检测使用 `moment.locale()`（非 localStorage）
- 文档站导航在 `doc/.vitepress/config.mts`，新增外部可见文档时同步更新 sidebar
- 模板设置使用 `TemplateConfig`（source: builtin/file/custom），入口在 `TemplateSettingHelper.ts`，预设内容定义在 `TemplatePresetUtil.ts`，编辑/预览模态框在 `TemplateEditorModal.ts`
- 自定义属性导入导出逻辑在 `CustomPropertyIO.ts`，导入仅接受带 `version` 和 `customProperties` 的 JSON
- 强制替换同步时的旧 frontmatter 继承在 `main.ts#createFile()` 和 `FrontmatterUtil.ts`
- 用户数据导出/导入系统在 `douban/userdata/`，核心类型在 `types.ts`，提取器在 `UserDataExtractor.ts`，合并器在 `UserDataMerger.ts`（无参构造）
- 导入预览模态框 `ImportPreviewModal` 三步流程：条目总览（勾选+属性管理）→ 字段差异对比（逐字段策略）→ 导入结果
- 属性管理支持三种操作：保持对比（keep）、忽略（ignore）、别名为（自由文本输入本地属性名）
- smart_merge 策略：数组去重合并，字符串拼接（`local / import`）
- Vault 扫描工具在 `VaultUtil.ts`，`scanVaultForDoubanIds()` 构建 `Map<doubanId, DoubanFileEntry>` 缓存供多个模块复用
- 强制同步数据保护在 `main.ts#createFile()` 中集成，通过 `UserDataExtractor` + `UserDataMerger` 保留用户自定义属性和正文分区
- `douban-info` callout 响应式布局使用 `flex-wrap: wrap`（非 `@media` 查询），原因：Obsidian 内容区有 `max-width`，视口断点不可靠
- 内置模板的 frontmatter 和表格栏目以 `douban/` 文件夹下各类型模板为设计参照
- create-note 功能（`DoubanNoteManager`）设置 frontmatter `笔记` 属性（格式为 `[[笔记路径|笔记文件名]]`），不修改表格
- 封面图片下载通过 `FileHandler.creatAttachmentWithData()`，支持 `overwriteCoverImage` 选项控制是否覆盖已有文件
- 短评提取通过 `filterCommentText()` 过滤标签文本（`/^标签[:：]/`），防止标签泄漏到短评字段；Movie/Book handler 的 fallback 路径也需经过滤
- `getGuessType()` 三层类型检测：关键词匹配 → JSON-LD `@type` → `og:type`；`handle()` 中 `parseSubjectFromHtml` 返回 null 且类型不匹配时直接标记 `failByDiffType`
- 同步结果新增文件数量分析（`SyncHandler.showResult()`），统计实际 .md 文件数并对比同步统计，自动分析差额原因
- `{{desc}}` 正文输出前会去除全角空格、行首尾空白、过滤纯空白行
- `{{menu}}` 正文输出使用 Markdown 列表格式（`- ` 前缀），书籍/音乐模板包裹在 callout 中
- 多行短评在 YAML frontmatter 中使用 `|` 块标量语法保留换行结构
- 书籍信息提取的默认分支支持文本节点（`nextSibling`），解决 `{{subTitle}}` 等纯文本字段获取失败
- `TextInputSuggest.close()` 需检查 `this.popper` 是否存在再 destroy，防止未初始化时崩溃
- `BookKeyValueMap` 的 key 已统一去掉冒号，查询前会 normalize 去掉末尾中英文冒号
- `TemplateConfig` 数据在 `migrateTemplateSettings()` 加载时自动修复（字符串→合法对象），`getTemplate()`、`getDefaultTemplatePath()`、`getConfig()` 读取时也做了容错，防止旧版本 bug 产生的损坏数据影响同步

## 下一阶段开发计划

详见 `doc/90_development_plan.md`。优先级：

1. 为 1.2.0 / 1.4.0 / 1.5.0 新功能补充截图与更完整文档示例
2. 为自定义属性导入导出补单元测试
3. 为用户数据导出/导入补单元测试
4. 为同步继承补更多 frontmatter 边界测试
