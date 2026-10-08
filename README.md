# 校园失物招领「拾回」

> 2026 秋软件工程第二次结对作业 —— 程序实现
> 把散落在群聊里、转瞬即逝的失物信息，集中到一个可浏览、可搜索、可发布的网页入口。

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
├── README.md              ← 本文件（目录说明 + 使用说明 + 测试 + API 约定）
├── server.js              ← Node 后端：静态服务 + REST API + JSON 持久化（零依赖）
├── package.json           ← 零依赖；start / test 脚本
├── .gitignore             ← 忽略 package-lock.json 等
├── data/
│   └── items.json         ← 数据存储（含种子数据，缺失时自动生成）
├── index.html             ← 首页（信息流 + 筛选 + 排序）
├── search.html            ← 搜索页（历史 + 热门 + 结果高亮 + 空状态）
├── detail.html            ← 详情页（联系 + 一键复制 + 收藏 + 分享）
├── publish.html           ← 发布页（表单 + 逐项校验 + 防重复提交 + 发布成功）
├── my.html                ← 我的发布（状态标签 + 标记已找到/已归还 + 自动下架）
├── css/
│   └── style.css          ← 公共样式（设计规范：主色 #0FA96B / 寻物琥珀 #F2994A）
├── js/
│   ├── core.js            ← 纯函数（搜索/筛选/排序/校验/高亮/状态文案），前后端共用
│   ├── api.js             ← 前端 fetch 封装（统一网络异常中文提示）
│   └── ui.js              ← 公共 UI 工具（卡片渲染/Toast/复制/uid）
├── assets/img/            ← 图片素材（当前用 emoji 图标占位）
└── tests/
    └── core.test.js       ← 单元测试（node:test，51 个用例，第三棒补充）
```

## 三、使用说明

### 1. 环境要求

- **Node.js ≥ 18**（本项目在 Node v24 上实测通过，见 `package.json` 的 `engines`）。
- 浏览器用 **谷歌 Chrome**（其他现代浏览器一般也可）。
- **不需要 `npm install`**：项目零第三方依赖，`dependencies` / `devDependencies` 均为空。

### 2. 启动服务

```bash
node server.js        # 等价于 npm start
```

终端出现下面两行即启动成功，用 Chrome 打开 <http://localhost:3000>：

```
校园失物招领「拾回」已启动：http://localhost:3000
数据文件：D:\...\102402113-102402114-102402115\data\items.json
```

### 3. 运行单元测试

```bash
npm test
```
> Windows PowerShell 用户如果遇到“禁止运行脚本”错误,可改用 `npm.cmd test`,或先执行:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```


### 4. 更换端口 / 隔离数据（开发与测试用）

两个环境变量都可用，互不影响：

```bash
PORT=8080 node server.js                        # 换端口 → http://localhost:8080
DATA_FILE=/tmp/probe.json PORT=3456 node server.js   # 换端口 + 用临时数据文件跑，不碰真实数据
```

> 本项目的联调验证就是这么做的：始终让服务读写临时数据文件，保证仓库里的 `data/items.json` 全程未被测试污染。

## 四、单元测试

### 工具与运行方式

用 **Node.js 内置的 `node:test` + `node:assert`**，无需 Mocha / Jest / Chai，**不引入任何第三方依赖**，也不用启动浏览器或后端服务。

```bash
npm test
# 实际执行：node --test "tests/**/*.test.js"
```

> 脚本里的通配符**必须带引号**：Node ≥ 22 不再接受 `node --test tests/` 这种目录写法（会报 `Cannot find module ...\tests`），且不加引号会被 cmd.exe / bash 抢先展开。带引号交给 Node 自己展开，以后新增嵌套测试文件会被自动收进。

### 覆盖范围

测试对象是 `js/core.js` —— 前后端共用的纯函数模块（无 DOM、无网络、无文件 IO），这也是整个项目可测试性的根基。

| 被测函数 | 用例数 | 验证内容 |
| --- | --- | --- |
| `searchItems` | 10 | 命中标题/描述、大小写与中文、无结果、空关键词与纯空格返回全部 |
| `filterItems` | 9 | 按 type / category / publisher 筛选；`status=active` 的自动下架语义 |
| `sortItems` | 4 | `newest` 倒序、`createdAt` 缺失或相同、不改动原数组 |
| `escapeHtml` | 3 | 五个 HTML 特殊字符、`null`/`undefined` 不抛异常 |
| `highlight` | 9 | 高亮包裹、**不破坏 HTML 实体**、正则元字符不误伤、XSS 不注入 |
| `validatePublish` | 9 | 各必填项缺失报错、非法 type 报错、长度上限的边界值 |
| `resolvedLabel` | 2 | `lost`→已找到、`found`→已归还 |
| 列表默认管线 | 5 | 复刻 `GET /api/items` 的 搜索→筛选→排序 全流程，含"已解决条目默认不下发" |

### 测试数据构造策略

用例按四类数据组织，都在 `tests/core.test.js` 顶部有说明：

- **正常数据**：校园卡、钥匙、雨伞这类典型条目，验证主流程走通。
- **边界数据**：空数组、空/纯空格关键词、首尾空格、`createdAt` 相同或缺失、字段长度**刚好等于上限**与**刚好越界一格**。
- **异常数据**：缺字段、字段为 `null`/`undefined`、非法 `type` —— 要求不抛异常且错误信息明确。
- **恶意数据**：XSS 载荷（`<img src=x onerror=...>`）、HTML 实体（`&#39;`）、正则元字符（`.*+?^${}()|[]\`）、超长重复串 —— 要求既不注入、也不报错、更不能被放行入库。

### 当前结果

```
ℹ tests 51
ℹ suites 8
ℹ pass 51
ℹ fail 0
```

## 五、API 约定

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/items` | 列表；query：`type`(lost/found)、`category`、`q`(搜索)、`sort`(newest)、`publisher`(uid)、`status`(默认 active，排除已解决=自动下架；传 `all` 返回全部) |
| GET | `/api/items/:id` | 详情 |
| POST | `/api/items` | 发布；body 含 type/title/category/location/time/description/contact/publisher；服务端二次校验，非法返回 400 |
| PATCH | `/api/items/:id` | 更新状态 `{status:"resolved"}`（标记已找到/已归还 → 自动下架） |

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
「我的发布」无登录方案：前端首次访问生成匿名 `uid` 存 `localStorage`，发布时作为 `publisher` 上传；`my.html` 据此查询自己的条目。

## 六、第三棒完成内容（闭环 · 测试 · 收尾）

第三棒的目标是**把整条链路真正跑通并留下证据**：发布 → 浏览/搜索 → 详情 → 联系发布者 → 标记已找到/已归还 → 自动下架。

### 1. 闭环功能

- **发布页 `publish.html`**：补齐全部字段与**逐项前端校验**（不再是提交后才看到后端 400）。校验规则集中在 `Core.validatePublish`，返回 `{字段名: 错误文案}`，前端把每条文案回填到对应输入框下方，并给输入框加 `.error` 高亮；后端 400 响应的 `errors` 结构完全一致，前端复用同一套回填逻辑。发布成功后弹层引导去「我的发布」或回首页；提交期间按钮置灰显示「发布中…」防重复提交；补上选填的昵称 / 学院。
- **我的发布 `my.html`**：读 `localStorage` 里的匿名 `uid` 作为 `publisher`，请求 `GET /api/items?publisher=<uid>&status=all`（`all` 才会带上已解决的历史条目）。每条展示状态标签——进行中 / 已找到（lost）/ 已归还（found），文案由 `Core.resolvedLabel(type)` 推导。点「标记已找到/已归还」→ `PATCH /api/items/:id {status:"resolved"}`，成功后重新拉取列表；**失败会把按钮还原**，让用户能重试，而不是卡在「处理中…」。
- **自动下架**：首页默认只请求 `status=active`，条目一旦标记为 `resolved` 就不再出现在信息流里，但仍保留在「我的发布」中可查。

### 2. 修复的缺陷

| 缺陷 | 根因 | 修法 |
| --- | --- | --- |
| **搜索页热门搜索点击无反应** | 历史提交在加「单条删除」时误删了 `hotList.querySelectorAll('.h').forEach(...addEventListener)`，热门行的监听器再也没绑上 | 改为**事件委托**：监听器只绑一次、绑在不会被重绘的父容器 `hotList` / `historyChips` 上，`e.target.closest()` 分发。以后无论怎么重绘都不会再丢监听器 |
| **首页标题里的 `'` 显示成 `&#39;`** | `items.map(UI.itemCard)` —— `map` 会把**数组下标**当作第二个参数 `keyword` 传进去。第 10 条（下标 9）命中关键词 `"9"`，`<mark>` 插进了转义产物 `&#39;` 中间，劈成 `&#3<mark>9</mark>;` | 写成 `items.map(function (it) { return UI.itemCard(it); })` |
| **`Core.highlight` 同类实体劈开缺陷** | `highlight` 内部也是「先整体转义、再在转义结果里 replace」，与上一条是同一个 bug class。`highlight("张三'的雨伞", "39")` 会输出 `张三&#<mark>39</mark>;的雨伞` | 改为**先按关键词切分原文、再逐段转义并包 `<mark>`**，用捕获组让命中片段落在 `split` 结果的奇数下标上。XSS 防护不变（每段仍逐段 `escapeHtml`） |
| **搜索页清空关键词后布局退化** | `defaultEl.style.display = ''` 会退化成 `block`，而该容器需要 `flex` | 显式写 `'flex'` |
| **网络异常直接把英文抛给用户** | `fetch` 只在完全没连上时 reject，原始信息是 `Failed to fetch` | 在 `js/api.js` 统一包一层，翻译成「网络异常，请稍后重试」，四个页面同时受益 |
| **连续改关键词时结果被旧响应覆盖** | 先发出的请求可能后返回 | 加 `searchToken` **竞态保护**，过期响应直接丢弃 |

### 3. 交互与异常兜底

- 搜索无结果 / 加载失败 / 搜索失败都有独立空状态文案，不再是白屏。
- 复制联系方式失败（非 HTTPS 或用户拒绝权限）会 Toast 提示。
- 已解决的条目再点标记 → 按钮变为「已处理」禁用态，并 Toast「该条已处理」。
- 所有用户输入渲染前必过 `Core.escapeHtml`，关键词高亮走切分后再转义。

### 4. 单元测试

见上文「四、单元测试」—— `tests/core.test.js`，51 个用例，`npm test` 一次通过。

### 5. 验证方式

除单元测试外，本轮用 **Chrome DevTools Protocol 驱动真实 Chrome**（用 Node 内置 `WebSocket` 直连 `--remote-debugging-port`，仍然是零依赖）做了端到端取证，覆盖桌面 1200×900 与手机 390×844 两种视口：真实鼠标点击 11 张卡片逐一确认跳转、点击计数确认「连点 3 次只发出 1 个 POST / 1 个 PATCH」、断网后确认 Toast 文案且服务端状态未被改动。所有联调都在 `DATA_FILE` 指向临时文件、独立 Chrome 配置目录下进行，`data/items.json` 全程未被污染。

## 七、协作分工（三棒接力）

- **第一棒（基础框架 + 后端）**：项目骨架、数据模型、`core.js`、`server.js`（静态 + API + JSON 落盘）、公共 CSS、5 个页面骨架、`api.js`/`ui.js`。
- **第二棒（页面与优化）**：首页、搜索、详情、收藏、分享、一键复制、搜索历史/热门搜索。
- **第三棒（闭环收尾）**：发布页、我的发布、状态更新、自动下架、修复搜索页点击与高亮缺陷、单元测试、完善 README、汇总博客。

