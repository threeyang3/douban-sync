## 书架效果

可以结合 Dataview 插件，把通过 Obsidian-Douban 同步或导入的书籍笔记整理成个人书架。

## 实现方式

1. 安装并启用 Dataview 插件。
2. 使用 Obsidian-Douban 导入或同步书籍数据。
3. 在书籍模板中写入稳定的 frontmatter 字段，例如 `type`、`title`、`author`、`score`、`myRating`、`myState`、`myCollectionDate`。
4. 新建一个书架笔记，使用 Dataview 查询这些字段。

示例：

````markdown
```dataview
table title, author, score, myRating, myState, myCollectionDate
from "Book"
sort myCollectionDate desc
```
````

实际查询路径需要按你的笔记保存目录调整。
