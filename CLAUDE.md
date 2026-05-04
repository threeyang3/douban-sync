# obsidian-douban

Obsidian 插件，从豆瓣导入电影、书籍、音乐、电视剧、日记、游戏数据到 Obsidian 笔记。

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

文档源码在 `doc/` 目录，使用 VitePress，部署到 https://obsidian-douban.wxp.hk/

## 关键约定

- 版本号同步修改 `package.json` 和 `manifest.json`
- 各类型数据 handler 继承 `DoubanAbstractLoadHandler`，同步 handler 继承 `DoubanAbstractSyncHandler`
- 模板变量定义在 `DefaultTemplateContent.ts`，解析在 `VariableUtil.ts`
- YAML frontmatter 生成在 `YamlUtil.ts`，多行文本使用 `handleMultiLineText()`
- 语言检测使用 `moment.locale()`（非 localStorage）
