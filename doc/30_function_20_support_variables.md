---
title: 支持的参数
nav_order: 500
parent: 功能
---

# 支持的字段
(若有缺少想导入的字段, 欢迎提issues反馈)

| 字段               | 电影               | 电视剧               | 书籍                | 音乐            | 日记             | 游戏            | 人物    |
|------------------|------------------|-------------------|-------------------|---------------|----------------|---------------|-------|
| id               | 豆瓣ID             | 豆瓣ID              | 豆瓣ID              | 豆瓣ID          | 豆瓣ID           | 豆瓣ID          | id    | 
| title            | 电影名称             | 电视剧名称             | 书名                | 音乐名           | 日记标题           | 游戏名称          | 姓名    |   
| type             | 类型               | 类型                | 类型                | 类型            | 类型             | 类型            | 类型    |   
| score            | 评分               | 评分                | 评分                | 评分            | 评分             | 评分            |       |   
| scoreStar        | 评分⭐               | 评分⭐                | 评分⭐                | 评分⭐            | 评分⭐             | 评分⭐            |       |   
| image            | 封面               | 封面                | 封面                | 封面            | 图片             | 封面            | 照片    |    
| imageData.url    | 封面url            | 封面url             | 封面url             | 封面url         | 封面url          | 封面url         | 照片url |    
| url              | 豆瓣网址             | 豆瓣网址              | 豆瓣网址              | 豆瓣网址          | 豆瓣网址           | 豆瓣网址          | 豆瓣网址  |    
| desc             | 简介               | 简介                | 内容简介              | 简介            | 简介             | 简介            | 简介    |    
| publisher        | -                | -                 | 出版社               | 出版者           | 发布者            | 发行商           | -     |    
| datePublished    | 上映日期             | 上映日期              | 出版年               | 发行时间          | 发布时间           | 发行日期          | -     |    
| yearPublished    | 上映年份             | 上映年份              | 出版年份              | 发行年份          | 发布年份           | 发行年份          | -     |    
| genre            | 类型               | 类型                | -                 | 流派            | -              | 类型            | -     |   
| currentDate      | 今日日期             | 今日日期              | 今日日期              | 今日日期          | 今日日期           | 今日日期          |       |  
| currentTime      | 当前时间             | 当前时间              | 当前时间              | 当前时间          | 当前时间           | 当前时间          |       |   
| myTags           | 我标记的标签           | 我标记的标签            | 我标记的标签            | 我标记的标签        | -              | 我标记的标签        |       |  
| myRating         | 我的评分             | 我的评分              | 我的评分              | 我的评分          | -              | 我的评分          |
| myState          | 状态:想看/在看/看过      | 状态:想看/在看/看过       | 状态:想看/在看/看过       | 状态:想听/在听/听过   | -              | 状态:想玩/在玩/玩过   |       |    
| myComment        | 我的评语             | 我的评语              | 我的评语              | 我的评语          | -              | 我的评语          |       |  
| myCollectionDate | 我标记的时间           | 我标记的时间            | 我标记的时间            | 我标记的时间        | -              | 我标记的时间        |       |   
| 扩展1              | director:导演*     | director:导演*      | author:原作者        | actor: 表演者    | author:作者      | aliases:别名    |       |   
| 扩展2              | author:编剧*       | author:编剧*        | translator:译者     | albumType:专辑类型 | authorUrl:作者网址 | developer:开发商 |       |    
| 扩展3              | actor:主演*        | actor:主演*         | isbn:isbn         | medium:介质     | content:日记内容   | platform:平台   |       |    
| 扩展4              | originalTitle:原作名 | originalTitle:原作名 | originalTitle:原作名 | records:唱片数   |                |               |       |   
| 扩展5              | country:国家       | country:国家        | subTitle:副标题      | barcode:条形码   |                |               |       |   
| 扩展6              | language:语言      | language:语言       | totalPage:页数      |               |                |               |       |    
| 扩展7              | time:片长          | time:片长           | series:丛书         |               |                |               |       |    
| 扩展8              | aliases:又名*      | aliases:又名*       | menu:目录           |               |                |               |       |    
| 扩展9              | IMDb             | IMDb              | price:定价          |               |                |               |       |     
| 扩展7              |                  | episode:集数        | binding:装帧        |               |                |               |       |    
| 扩展8              |                  |                   | producer: 出品方     |               |                |               |       |

# 模板语法注意事项

## 变量格式

模板变量使用双花括号 `{{变量名}}`，不带空格：

```
title: {{title}}
doubanId: {{id}}
```

## Wiki Link 包裹

当变量需要用 `[[ ]]` 包裹为 wiki link 时，**必须用双引号将整个值括起来**，否则 `[` 会被 YAML 解析器视为特殊字符，导致值被额外加引号：

```yaml
# 正确 ✓
image: "[[{{image}}]]"
url: "[[{{url}}]]"

# 错误 ✗ — 同步后会变成 [["url"]]，多出一层引号
image: [[{{image}}]]
url: [[{{url}}]]
```

原因：模板替换后 `[[url]]` 中的 `[` 是 YAML 特殊字符，插件会自动用双引号包裹以保证 YAML 合法性。提前加引号可以避免二次包裹。

## 其他注意事项

- 变量名区分大小写：`{{title}}` 和 `{{Title}}` 是不同的变量
- 变量值中的特殊字符（`:`、`#`、`"` 等）会被自动处理为合法 YAML
- 多行文本（如 `{{desc}}`）会自动使用 YAML 块标量语法 `|` 保留换行
