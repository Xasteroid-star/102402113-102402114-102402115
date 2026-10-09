# 校园失物招领「拾回」

> 2026 秋软件工程第二次结对作业 —— 程序实现
> 把散落在群聊里、转瞬即逝的失物信息，集中到一个可浏览、可搜索、可发布的网页入口。

> ⚠️ **本版本为纯静态实现**（HTML + CSS + 原生 JavaScript + localStorage，**无后端、无 Node、无数据库**）。
> 第六节「第三棒完成内容」记录的是**上一版 Node 后端**的开发过程，其中提到的 `server.js`、`/api/...`、
> `DATA_FILE` 均已移除；同名功能现在由 `js/api.js` 直接读写浏览器 localStorage 实现，界面与交互完全一致。

## 一、功能

- **浏览信息流**：首页按「全部 / 寻物 / 招领」筛选，按最新发布排序。
- **发布信息**：填写寻物 / 招领、物品名称、分类、地点、时间、描述、联系方式（必填项校验）。
- **搜索物品**：按物品名称等关键词搜索，结果关键词高亮，无结果给空状态。
- **查看详情与联系**：展示地点、时间、描述与联系方式，支持一键复制联系方式。
- **我的发布**：物品找回 / 归还后由发布者标记「已找到 / 已归还」，自动下架，减少重复询问。
- **附加特点**：搜索历史 + 热门搜索、收藏、分享。

## 二、目录说明

```
102402113-102402114-102402115/
├── README.md              ← 本文件（目录说明 + 使用说明 + 测试 + 存储说明）
├── package.json           ← 仅 npm test 脚本（可选，跑单元测试用）
├── .gitignore             ← 忽略 package-lock.json 等
├── index.html             ← 首页（信息流 + 筛选 + 排序）
├── search.html            ← 搜索页（历史 + 热门 + 结果高亮 + 空状态）
├── detail.html            ← 详情页（联系 + 一键复制 + 收藏 + 分享）
├── publish.html           ← 发布页（表单 + 逐项校验 + 防重复提交 + 发布成功）
├── my.html                ← 我的发布（状态标签 + 标记已找到/已归还 + 自动下架）
├── css/
│   └── style.css          ← 公共样式（设计规范：主色 #0FA96B / 寻物琥珀 #F2994A）
├── js/
│   ├── core.js            ← 纯函数（搜索/筛选/排序/校验/高亮/状态文案）
│   ├── seed.js            ← 种子演示数据（首次打开灌入 localStorage，10 条）
│   ├── api.js             ← 前端数据层（localStorage 读写，接口与原来一致）
│   └── ui.js              ← 公共 UI 工具（卡片渲染/Toast/复制/uid）
├── assets/img/            ← 图片素材（当前用 emoji 图标占位）
└── tests/
    ├── core.test.js       ← 纯函数单元测试（node:test，51 个用例）
    └── api.test.js        ← 数据层单元测试（localStorage 桩，23 个用例）
```

## 三、使用说明（测试人员请看这里）

### 1. 运行方式

**不需要安装任何环境、不需要联网、不需要启动服务器。**

1. 把本项目所有文件下载到本地（保持目录结构不变）。
2. 用 **谷歌浏览器（Chrome）** 打开 `index.html` 即可。

> 本项目为**纯静态网页**（HTML + CSS + 原生 JavaScript），所有数据保存在浏览器本机
> **localStorage**，因此不需要 Node.js、npm、数据库或后端服务。首次打开会自动载入
> **10 条演示数据**，方便直接体验浏览与搜索。

### 2. 建议的体验顺序

1. **首页**：切换「全部 / 寻物 / 招领」浏览信息流，点任意卡片进详情。
2. **搜索**：输入关键词（如「校园卡」「钥匙」），看结果高亮与搜索历史 / 热门搜索。
3. **详情**：查看地点 / 时间 / 描述，点「联系 TA」一键复制联系方式；点收藏。
4. **发布**：点底部 ＋ 发布一条寻物 / 招领信息，看必填项校验与成功弹层。
5. **我的发布**：看到刚发布的条目，点「标记已找到 / 已归还」→ 自动下架。

> 想重置数据：Chrome 按 F12 → Console 执行 `localStorage.removeItem('items')` 后刷新，
> 会重新载入 10 条演示数据。

### 3. 单元测试（可选，仅开发自测）

纯函数测试用 Node 内置 `node:test`，**不影响**上面双击打开的运行方式：

```bash
npm test
```
> Windows PowerShell 用户如果遇到“禁止运行脚本”错误，可改用 `npm.cmd test`，或先执行：
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

## 四、单元测试

### 工具与运行方式

用 **Node.js 内置的 `node:test` + `node:assert`**，无需 Mocha / Jest / Chai，**不引入任何第三方依赖**，也不用启动浏览器。

```bash
npm test
# 实际执行：node --test "tests/**/*.test.js"
```

> 脚本里的通配符**必须带引号**：Node ≥ 22 不再接受 `node --test tests/` 这种目录写法（会报 `Cannot find module ...\tests`），且不加引号会被 cmd.exe / bash 抢先展开。带引号交给 Node 自己展开，以后新增嵌套测试文件会被自动收进。

### 覆盖范围

测试对象是 `js/core.js` —— 纯函数模块（无 DOM、无网络、无文件 IO），这也是整个项目可测试性的根基。

| 被测函数 | 用例数 | 验证内容 |
| --- | --- | --- |
| `searchItems` | 10 | 命中标题/描述、大小写与中文、无结果、空关键词与纯空格返回全部 |
| `filterItems` | 9 | 按 type / category / publisher 筛选；`status=active` 的自动下架语义 |
| `sortItems` | 4 | `newest` 倒序、`createdAt` 缺失或相同、不改动原数组 |
| `escapeHtml` | 3 | 五个 HTML 特殊字符、`null`/`undefined` 不抛异常 |
| `highlight` | 9 | 高亮包裹、**不破坏 HTML 实体**、正则元字符不误伤、XSS 不注入 |
| `validatePublish` | 9 | 各必填项缺失报错、非法 type 报错、长度上限的边界值 |
| `resolvedLabel` | 2 | `lost`→已找到、`found`→已归还 |
| 列表默认管线 | 5 | 复刻列表的 搜索→筛选→排序 全流程，含"已解决条目默认不下发" |

`tests/api.test.js` 另测**数据层** `js/api.js`（23 个用例）：不起服务、不开浏览器，用一个内存
`Map` 造 `localStorage` 桩，直接对真实数据层下断言。

| 被测方法 / 场景 | 用例数 | 验证内容 |
| --- | --- | --- |
| 种子初始化 | 4 | 首次读取灌 10 条；坏 JSON 退回种子；本地已有数据不被种子覆盖 |
| `API.list` | 7 | 默认 `active` 自动下架；`status=all` 看历史；type / category / publisher 组合筛选；排序；空库返回 `[]` |
| `API.get` | 2 | 按 id 取到条目；不存在时 reject 404 且带中文提示 |
| `API.publish` | 5 | 校验不通过不入库；合法表单落库且字段正确；去首尾空格；描述选填；超长被拦 |
| `API.resolve` | 3 | 状态改 `resolved` 并持久化；不存在 reject 404；重复标记幂等 |
| 闭环 | 2 | 发布 → 首页可见 → 标记 → 首页消失，且搜索也搜不到 |

### 测试数据构造策略

用例按四类数据组织，都在 `tests/core.test.js` 顶部有说明：

- **正常数据**：校园卡、钥匙、雨伞这类典型条目，验证主流程走通。
- **边界数据**：空数组、空/纯空格关键词、首尾空格、`createdAt` 相同或缺失、字段长度**刚好等于上限**与**刚好越界一格**。
- **异常数据**：缺字段、字段为 `null`/`undefined`、非法 `type` —— 要求不抛异常且错误信息明确。
- **恶意数据**：XSS 载荷（`<img src=x onerror=...>`）、HTML 实体（`&#39;`）、正则元字符（`.*+?^${}()|[]\`）、超长重复串 —— 要求既不注入、也不报错、更不能被放行入库。

### 当前结果

```
ℹ tests 74
ℹ suites 14
ℹ pass 74
ℹ fail 0
```

（`core.test.js` 51 + `api.test.js` 23）

## 五、数据存储（localStorage）

本版本为纯静态网页，**没有后端、没有 REST API**。`js/api.js` 的四个方法改为读写浏览器
`localStorage`（键 `items`），**对外接口保持不变**，页面逻辑零改动：

| 方法 | 作用 | 说明 |
| --- | --- | --- |
| `API.list(params)` | 列表 | 支持 `type` / `category` / `q`(搜索) / `sort` / `publisher` / `status`；默认 `active`，已解决自动下架 |
| `API.get(id)` | 详情 | 找不到时抛「未找到该条信息」 |
| `API.publish(item)` | 发布 | 复用 `Core.validatePublish` 校验，非法返回 `{errors}` 逐项回填 |
| `API.resolve(id)` | 更新状态 | 标记已找到 / 已归还 → `status:'resolved'` → 自动下架 |

### 数据模型

```json
{
  "id": "t...",
  "type": "lost | found",
  "title": "物品名称",
  "category": "证件卡类 | 钥匙 | 雨伞 | 水杯 | 耳机 | 图书 | 其他",
  "location": "地点",
  "time": "2026-10-02 12:30",
  "description": "描述",
  "contact": "联系方式",
  "image": "",
  "status": "active | resolved",
  "publisher": "发布者匿名 uid（无登录）",
  "publisherName": "发布者昵称（展示用，选填）",
  "dept": "发布者学院（展示用，选填）",
  "createdAt": 1790899200000
}
```

「已找到 vs 已归还」由 `type` 推导：`lost`→已找到，`found`→已归还。
「我的发布」无登录方案：前端首次访问生成匿名 `uid` 存 `localStorage`，发布时作为
`publisher` 写入；`my.html` 据此筛选本机发布的条目。

> 注意：localStorage 是**每台浏览器各一份、互不相通**（纯前端方案，无共享服务器）。
> 因此演示时每台电脑看到的是自己浏览器里的数据；「我的发布」只含本机发布条目。


## 六、协作分工（三棒接力）

- **第一棒（基础框架 + 数据层）**：项目骨架、数据模型、`core.js`、公共 CSS、5 个页面骨架、`api.js`/`ui.js`。
- **第二棒（页面与优化）**：首页、搜索、详情、收藏、分享、一键复制、搜索历史/热门搜索。
- **第三棒（闭环收尾）**：发布页、我的发布、状态更新、自动下架、修复搜索页点击与高亮缺陷、单元测试、完善 README、汇总博客。
