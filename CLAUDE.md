# douban-sync

Obsidian 插件，从豆瓣导入电影、书籍、音乐、电视剧、日记、游戏数据到 Obsidian 笔记。

## 当前仓库状态

- 当前主仓库：`https://github.com/threeyang3/douban-sync`
- 当前开发分支：`adv`
- 当前版本基线：`1.2.0`
- `origin` 指向 `douban-sync`；旧远端保留为 `obsidian-douban`
- 对外 README 和 `doc/` 已移除原项目个人化内容，只保留插件本身介绍与使用说明

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
│   └── sync/          # 同步逻辑（handler/model/component）
├── lang/              # 多语言支持
├── utils/             # 工具类（YamlUtil、VariableUtil 等）
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
- 各类型数据 handler 继承 `DoubanAbstractLoadHandler`，同步 handler 继承 `DoubanAbstractSyncHandler`
- 模板变量定义在 `DefaultTemplateContent.ts`，解析在 `VariableUtil.ts`
- YAML frontmatter 生成在 `YamlUtil.ts`，多行文本使用 `handleMultiLineText()`
- 语言检测使用 `moment.locale()`（非 localStorage）
- 文档站导航在 `doc/.vitepress/config.mts`，新增外部可见文档时同步更新 sidebar
- 模板设置支持内置预设写入，入口在 `TemplateSettingHelper.ts`，预设内容定义在 `TemplatePresetUtil.ts`
- 自定义属性导入导出逻辑在 `CustomPropertyIO.ts`，导入仅接受带 `version` 和 `customProperties` 的 JSON
- 强制替换同步时的旧 frontmatter 继承在 `main.ts#createFile()` 和 `FrontmatterUtil.ts`

## 下一阶段开发计划

详见 `doc/90_development_plan.md`。优先级：

1. 为 1.2.0 新功能补充截图与更完整文档示例
2. 为自定义属性导入导出补单元测试
3. 为同步继承补更多 frontmatter 边界测试
