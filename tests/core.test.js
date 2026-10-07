/* tests/core.test.js —— js/core.js 纯函数单元测试
 *
 * 运行：npm test        等价于 node --test tests/
 * 工具：Node 内置测试运行器 node:test（Node 18+），零依赖、不装 Mocha / Jest。
 *       node:test 的用法与 Mocha 类似（describe/it 风格的 test() + 断言），
 *       但断言用 Node 自带的 node:assert，不需要任何 package.json 之外的依赖。
 *
 * 本文件只测纯函数：不碰 DOM、不发网络请求、不读文件，所以可以直接 require 后端共用的
 * js/core.js（core.js 在 Node 下走 module.exports，在浏览器下挂到 window.Core）。
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const Core = require('../js/core.js');

/* ============================================================
 * 测试数据构造思路：正常 / 边界 / 异常 / 恶意 四类
 * ------------------------------------------------------------
 * 正常：校园里最典型的失物招领条目（校园卡、钥匙），用来验证主流程。
 * 边界：空数组、空关键词、纯空格、首尾空格、createdAt 相同（排序稳定性）、
 *       超过长度上限的字段，用来验证「刚好不越界」和「刚好越界」。
 * 异常：缺字段、字段为 null/undefined、非法 type、非法 status，
 *       用来验证不抛异常且给出明确错误。
 * 恶意：XSS 载荷、HTML 实体、正则元字符、超长重复串，
 *       用来验证不会注入标签、不会因为正则元字符而报错或误伤。
 * ============================================================ */

/** 造一条合法条目，只覆盖需要变动的字段 */
function make(over) {
  return Object.assign({
    id: 't-1',
    type: 'lost',
    title: '物品',
    category: '其他',
    location: '地点',
    time: '2026-10-01 10:00',
    description: '',
    contact: 'wx_test',
    status: 'active',
    publisher: 'u-1',
    createdAt: 1000
  }, over || {});
}

// 正常数据
const CARD = make({
  id: 't-card', type: 'found', title: '捡到一张校园卡', category: '证件卡类',
  location: '三教 201 门口', time: '2026-10-02 09:30',
  description: '卡面贴有一张卡通贴纸，请失主联系我核对姓名。', createdAt: 2000
});
const KEY = make({
  id: 't-key', type: 'lost', title: '丢失一串宿舍钥匙', category: '钥匙',
  location: '图书馆三楼', time: '2026-10-03 18:00',
  description: '钥匙扣上有个小熊挂件，共三把。', createdAt: 3000
});
const UMBRELLA = make({
  id: 't-umb', type: 'found', title: '捡到一把黑色雨伞', category: '雨伞',
  location: '一食堂二楼', time: '2026-10-04 12:00', description: '', createdAt: 1500
});
const RESOLVED = make({
  id: 't-done', type: 'lost', title: '丢失一张校园卡', category: '证件卡类',
  location: '二教', time: '2026-10-05 08:00', description: '已找回', status: 'resolved',
  createdAt: 2500
});
const NORMAL = [CARD, KEY, UMBRELLA, RESOLVED];

/* ============================================================
 * 复刻 server.js 里 GET /api/items 的默认管线：
 * 搜索 → 筛选（status 缺省为 active，即"自动下架"）→ 排序
 * 这样"resolved 条目在默认列表中被排除"这条规则可以在纯函数层面被完整验证。
 * ============================================================ */
function listLike(items, query) {
  query = query || {};
  let r = items.slice();
  if (query.q) r = Core.searchItems(r, query.q);
  r = Core.filterItems(r, {
    type: query.type,
    category: query.category,
    status: query.status || 'active',   // ← 默认只返回进行中 = 自动下架
    publisher: query.publisher
  });
  return Core.sortItems(r, query.sort || 'newest');
}

/* ============================================================
 * searchItems —— 关键词搜索
 * ============================================================ */
describe('searchItems 关键词搜索', () => {
  test('命中物品名称', () => {
    const hit = Core.searchItems(NORMAL, '校园卡');
    assert.deepStrictEqual(hit.map(i => i.id), ['t-card', 't-done']);
  });

  test('命中详细描述', () => {
    const hit = Core.searchItems(NORMAL, '小熊挂件');
    assert.deepStrictEqual(hit.map(i => i.id), ['t-key']);
  });

  test('英文大小写不敏感', () => {
    const items = [make({ id: 'a', title: 'Lost Umbrella' }), make({ id: 'b', title: 'FOUND KEY' })];
    assert.deepStrictEqual(Core.searchItems(items, 'umbrella').map(i => i.id), ['a']);
    assert.deepStrictEqual(Core.searchItems(items, 'found key').map(i => i.id), ['b']);
    assert.deepStrictEqual(Core.searchItems(items, 'UMBRELLA').map(i => i.id), ['a']);
  });

  test('中文关键词命中（含空格的关键词不跨字段匹配）', () => {
    assert.deepStrictEqual(Core.searchItems(NORMAL, '雨伞').map(i => i.id), ['t-umb']);
    // 关键词 "钥匙 图书馆" 在两段文本里分别出现，但都不连续出现 → 不该命中
    assert.deepStrictEqual(Core.searchItems(NORMAL, '钥匙 图书馆'), []);
  });

  test('搜不到时返回空数组，而不是报错', () => {
    assert.deepStrictEqual(Core.searchItems(NORMAL, '这个词一定搜不到xyzzy'), []);
  });

  test('空关键词 / 纯空格 / null / undefined 都返回全部', () => {
    for (const kw of ['', '   ', null, undefined]) {
      assert.strictEqual(Core.searchItems(NORMAL, kw).length, NORMAL.length, '关键词=' + JSON.stringify(kw));
    }
  });

  test('返回的是新数组，不会把原数组交出去（避免调用方改坏数据）', () => {
    const out = Core.searchItems(NORMAL, '');
    assert.notStrictEqual(out, NORMAL);
    out.push(make({ id: 'x' }));
    assert.strictEqual(NORMAL.length, 4);
  });

  test('关键词首尾空格被忽略', () => {
    assert.deepStrictEqual(Core.searchItems(NORMAL, '  校园卡  ').map(i => i.id), ['t-card', 't-done']);
  });

  test('边界：条目 title / description 为 null 或缺失时不崩', () => {
    const broken = [{ id: 'n1' }, { id: 'n2', title: null, description: null }];
    assert.deepStrictEqual(Core.searchItems(broken, '校园卡'), []);
  });

  test('恶意：正则元字符关键词不报错也不误伤', () => {
    const evil = [make({ id: 'e1', title: 'A.B' }), make({ id: 'e2', title: 'AXB' })];
    assert.deepStrictEqual(Core.searchItems(evil, '.').map(i => i.id), ['e1']);   // 只匹配真的点
    for (const kw of ['(unclosed', '[', '\\', '*', '+?', '$^', '{}', '|']) {
      assert.doesNotThrow(() => Core.searchItems(NORMAL, kw), '关键词=' + kw);
    }
  });
});

/* ============================================================
 * filterItems —— 组合筛选
 * ============================================================ */
describe('filterItems 筛选', () => {
  test('按 type 筛选：lost 只出寻物', () => {
    const lost = Core.filterItems(NORMAL, { type: 'lost' });
    assert.deepStrictEqual(lost.map(i => i.type), ['lost', 'lost']);
    assert.deepStrictEqual(lost.map(i => i.id), ['t-key', 't-done']);
  });

  test('按 type 筛选：found 只出招领', () => {
    const found = Core.filterItems(NORMAL, { type: 'found' });
    assert.deepStrictEqual(found.map(i => i.id), ['t-card', 't-umb']);
  });

  test('按 category 筛选', () => {
    assert.deepStrictEqual(Core.filterItems(NORMAL, { category: '证件卡类' }).map(i => i.id), ['t-card', 't-done']);
    assert.deepStrictEqual(Core.filterItems(NORMAL, { category: '耳机' }), []);
  });

  test('status=active 排除已解决条目（自动下架）', () => {
    const active = Core.filterItems(NORMAL, { status: 'active' });
    assert.ok(active.every(i => i.status === 'active'));
    assert.strictEqual(active.length, 3);
    assert.ok(!active.some(i => i.id === 't-done'));
  });

  test('status=all 保留已解决条目（我的发布要看历史）', () => {
    assert.strictEqual(Core.filterItems(NORMAL, { status: 'all' }).length, 4);
  });

  test('按 publisher 筛选（我的发布只查自己的）', () => {
    const mine = [make({ id: 'm1', publisher: 'u-me' }), make({ id: 'm2', publisher: 'u-other' })];
    assert.deepStrictEqual(Core.filterItems(mine, { publisher: 'u-me' }).map(i => i.id), ['m1']);
  });

  test('空 opts / 不传 opts 返回全部', () => {
    assert.strictEqual(Core.filterItems(NORMAL, {}).length, 4);
    assert.strictEqual(Core.filterItems(NORMAL).length, 4);
  });

  test('多条件组合是交集', () => {
    const r = Core.filterItems(NORMAL, { type: 'lost', category: '钥匙', status: 'active' });
    assert.deepStrictEqual(r.map(i => i.id), ['t-key']);
    // 条件互相排斥时交集为空
    assert.deepStrictEqual(Core.filterItems(NORMAL, { type: 'found', category: '钥匙' }), []);
  });

  test('边界：空数组进去空数组出来', () => {
    assert.deepStrictEqual(Core.filterItems([], { type: 'lost' }), []);
  });
});

/* ============================================================
 * sortItems —— 排序
 * ============================================================ */
describe('sortItems 排序', () => {
  test('sort=newest 按 createdAt 倒序（最新在前）', () => {
    const sorted = Core.sortItems(NORMAL, 'newest');
    assert.deepStrictEqual(sorted.map(i => i.id), ['t-key', 't-done', 't-card', 't-umb']);
    assert.deepStrictEqual(sorted.map(i => i.createdAt), [3000, 2500, 2000, 1500]);
  });

  test('不传 sort / 传未知值保持原顺序', () => {
    assert.deepStrictEqual(Core.sortItems(NORMAL).map(i => i.id), NORMAL.map(i => i.id));
    assert.deepStrictEqual(Core.sortItems(NORMAL, 'whatever').map(i => i.id), NORMAL.map(i => i.id));
  });

  test('边界：createdAt 缺失或相同不会让比较崩掉', () => {
    const items = [{ id: 'a' }, { id: 'b', createdAt: 100 }, { id: 'c', createdAt: 100 }];
    assert.doesNotThrow(() => Core.sortItems(items, 'newest'));
    assert.strictEqual(Core.sortItems(items, 'newest')[0].createdAt, 100);
  });

  test('不改动原数组（返回新数组）', () => {
    const before = NORMAL.map(i => i.id);
    Core.sortItems(NORMAL, 'newest');
    assert.deepStrictEqual(NORMAL.map(i => i.id), before);
  });
});

/* ============================================================
 * escapeHtml —— 转义
 * ============================================================ */
describe('escapeHtml 转义', () => {
  test('五个敏感字符都被转义', () => {
    assert.strictEqual(Core.escapeHtml('&'), '&amp;');
    assert.strictEqual(Core.escapeHtml('<'), '&lt;');
    assert.strictEqual(Core.escapeHtml('>'), '&gt;');
    assert.strictEqual(Core.escapeHtml('"'), '&quot;');
    assert.strictEqual(Core.escapeHtml("'"), '&#39;');
  });

  test('恶意：整段 XSS 载荷被转义成纯文本', () => {
    const out = Core.escapeHtml('<img src=x onerror=alert(1)>');
    assert.ok(out.indexOf('<') === -1, '不能残留左尖括号');
    assert.ok(out.indexOf('>') === -1, '不能残留右尖括号');
    assert.strictEqual(out, '&lt;img src=x onerror=alert(1)&gt;');
  });

  test('边界：null / undefined / 数字不崩', () => {
    assert.strictEqual(Core.escapeHtml(null), '');
    assert.strictEqual(Core.escapeHtml(undefined), '');
    assert.strictEqual(Core.escapeHtml(0), '0');
  });
});

/* ============================================================
 * highlight —— 关键词高亮
 * ============================================================ */
describe('highlight 关键词高亮', () => {
  test('关键词被 <mark> 正确包裹', () => {
    assert.strictEqual(Core.highlight('捡到一张校园卡', '校园卡'), '捡到一张<mark>校园卡</mark>');
  });

  test('一处文本里的多处命中都被包裹', () => {
    assert.strictEqual(Core.highlight('雨伞和雨伞', '雨伞'), '<mark>雨伞</mark>和<mark>雨伞</mark>');
  });

  test('大小写不敏感，但保留原文大小写', () => {
    assert.strictEqual(Core.highlight('Lost Umbrella', 'umbrella'), 'Lost <mark>Umbrella</mark>');
  });

  test('空关键词只转义、不加 <mark>', () => {
    assert.strictEqual(Core.highlight('校园卡', ''), '校园卡');
    assert.strictEqual(Core.highlight('A&B', '  '), 'A&amp;B');
  });

  test('文本里的 HTML 被转义，不会真的产生标签', () => {
    const out = Core.highlight('<b>雨伞</b>', '雨伞');
    assert.strictEqual(out, '&lt;b&gt;<mark>雨伞</mark>&lt;/b&gt;');
  });

  test('恶意：XSS 载荷只作为文本显示，不产生可执行标签', () => {
    const payload = '<img src=x onerror=alert(1)>雨伞';
    const out = Core.highlight(payload, '雨伞');
    assert.ok(out.indexOf('<img') === -1, '不能出现真实 img 标签');
    assert.ok(out.indexOf('onerror=alert(1)') !== -1, '载荷应按原文保留，只是被转义');
    // 除了我们自己的 <mark>，不能有其他标签
    assert.strictEqual(out.replace(/<\/?mark>/g, '').indexOf('<'), -1);
  });

  test('恶意：正则元字符关键词不报错，且只按字面匹配', () => {
    assert.doesNotThrow(() => Core.highlight('a.b', '.'));
    assert.strictEqual(Core.highlight('a.b', '.'), 'a<mark>.</mark>b');
    assert.strictEqual(Core.highlight('.*+?^${}()|[]\\', '.*'), '<mark>.*</mark>+?^${}()|[]\\');
  });

  test('回归：不会把 HTML 实体劈成两半', () => {
    // 先整体转义、再在转义结果里 replace 的写法，会让关键词 "39" 命中 &#39; 里面的 39，
    // 生成 &#3<mark>9</mark>; —— 实体失效，用户看到的是 &#39; 原文。
    assert.strictEqual(Core.highlight("张三'的雨伞", '39'), '张三&#39;的雨伞');
    assert.strictEqual(Core.highlight('A&B', 'amp'), 'A&amp;B');
    // 命中引号本身时，mark 应该包住整个实体，而不是插在实体中间
    assert.strictEqual(Core.highlight("张三'的雨伞", "'"), "张三<mark>&#39;</mark>的雨伞");
  });

  test('边界：null 文本不崩', () => {
    assert.strictEqual(Core.highlight(null, 'a'), '');
  });
});

/* ============================================================
 * validatePublish —— 发布表单校验
 * ============================================================ */
describe('validatePublish 表单校验', () => {
  const OK = {
    type: 'lost', title: '校园卡', category: '证件卡类', location: '三教 201',
    time: '2026-10-05 10:00', description: '', contact: 'wx_test'
  };

  test('全部填好 → ok=true 且没有错误', () => {
    const v = Core.validatePublish(OK);
    assert.strictEqual(v.ok, true);
    assert.deepStrictEqual(v.errors, {});
  });

  test('缺少必填项 → 逐项返回错误，且 ok=false', () => {
    const v = Core.validatePublish({});
    assert.strictEqual(v.ok, false);
    assert.deepStrictEqual(Object.keys(v.errors).sort(),
      ['category', 'contact', 'location', 'time', 'title', 'type']);
    assert.strictEqual(v.errors.title, '请填写物品名称');
    assert.strictEqual(v.errors.contact, '请填写联系方式');
    assert.strictEqual(v.errors.location, '请填写地点');
    assert.strictEqual(v.errors.time, '请填写时间');
  });

  test('只缺一项时，只报那一项', () => {
    const v = Core.validatePublish(Object.assign({}, OK, { contact: '' }));
    assert.deepStrictEqual(Object.keys(v.errors), ['contact']);
  });

  test('非法 type → 报错', () => {
    assert.strictEqual(Core.validatePublish(Object.assign({}, OK, { type: 'x' })).errors.type, '请选择寻物或招领');
    assert.strictEqual(Core.validatePublish(Object.assign({}, OK, { type: '' })).errors.type, '请选择寻物或招领');
    assert.strictEqual(Core.validatePublish(Object.assign({}, OK, { type: null })).errors.type, '请选择寻物或招领');
    assert.strictEqual(Core.validatePublish(Object.assign({}, OK, { type: 'lost' })).errors.type, undefined);
    assert.strictEqual(Core.validatePublish(Object.assign({}, OK, { type: 'found' })).errors.type, undefined);
  });

  test('纯空格 / null / undefined 都算没填', () => {
    for (const bad of ['   ', null, undefined]) {
      const v = Core.validatePublish(Object.assign({}, OK, { title: bad }));
      assert.strictEqual(v.ok, false, 'title=' + JSON.stringify(bad));
      assert.strictEqual(v.errors.title, '请填写物品名称');
    }
  });

  test('边界：超过长度上限被拦下，刚好等于上限通过', () => {
    const L = Core.LIMITS;
    assert.strictEqual(Core.validatePublish(Object.assign({}, OK, { title: '伞'.repeat(L.title) })).ok, true);
    assert.strictEqual(Core.validatePublish(Object.assign({}, OK, { title: '伞'.repeat(L.title + 1) })).errors.title,
      '物品名称不超过 ' + L.title + ' 个字');
    assert.ok(Core.validatePublish(Object.assign({}, OK, { contact: 'x'.repeat(L.contact + 1) })).errors.contact);
    assert.ok(Core.validatePublish(Object.assign({}, OK, { location: 'x'.repeat(L.location + 1) })).errors.location);
    assert.ok(Core.validatePublish(Object.assign({}, OK, { time: 'x'.repeat(L.time + 1) })).errors.time);
    assert.ok(Core.validatePublish(Object.assign({}, OK, { description: 'x'.repeat(L.description + 1) })).errors.description);
  });

  test('详细描述是选填，可以为空；超长才报错', () => {
    assert.strictEqual(Core.validatePublish(Object.assign({}, OK, { description: '' })).ok, true);
    assert.strictEqual(Core.validatePublish({ type: 'lost', title: 't', category: 'c', location: 'l', time: 'i', contact: 'c' }).ok, true);
  });

  test('异常：不传参数 / 传 null 不抛异常', () => {
    assert.doesNotThrow(() => Core.validatePublish());
    assert.strictEqual(Core.validatePublish(null).ok, false);
    assert.strictEqual(Core.validatePublish(undefined).ok, false);
  });

  test('恶意：长度上限对超长重复串同样生效（防止撑爆列表与详情页）', () => {
    const v = Core.validatePublish(Object.assign({}, OK, { title: '<img>'.repeat(500) }));
    assert.strictEqual(v.ok, false);
    assert.ok(v.errors.title);
  });
});

/* ============================================================
 * resolvedLabel —— 状态文案
 * ============================================================ */
describe('resolvedLabel 状态文案', () => {
  test('寻物（lost）→ 已找到', () => {
    assert.strictEqual(Core.resolvedLabel('lost'), '已找到');
  });

  test('招领（found）→ 已归还', () => {
    assert.strictEqual(Core.resolvedLabel('found'), '已归还');
  });
});

/* ============================================================
 * 组合管线 —— 复刻 GET /api/items 的默认行为
 * ============================================================ */
describe('列表默认管线（搜索 → 筛选 → 排序）', () => {
  test('resolved 条目在默认列表中被排除（自动下架）', () => {
    const out = listLike(NORMAL, {});
    assert.ok(!out.some(i => i.id === 't-done'), '已解决条目不该出现在默认列表');
    assert.strictEqual(out.length, 3);
  });

  test('传 status=all 时已解决条目回来（我的发布历史）', () => {
    const out = listLike(NORMAL, { status: 'all' });
    assert.strictEqual(out.length, 4);
    assert.ok(out.some(i => i.id === 't-done'));
  });

  test('默认按最新排序，最新一条在最前', () => {
    assert.strictEqual(listLike(NORMAL, {})[0].id, 't-key');
  });

  test('搜索 + 类型筛选 + 默认下架规则叠加生效', () => {
    // 搜"校园卡"能命中 2 条，其中 1 条已解决 → 默认列表只剩 1 条
    assert.deepStrictEqual(listLike(NORMAL, { q: '校园卡' }).map(i => i.id), ['t-card']);
    assert.deepStrictEqual(listLike(NORMAL, { q: '校园卡', status: 'all' }).map(i => i.id), ['t-done', 't-card']);
    // 招领 + 证件卡类 → 只剩招领那条
    assert.deepStrictEqual(listLike(NORMAL, { type: 'found', category: '证件卡类' }).map(i => i.id), ['t-card']);
  });

  test('整条管线对恶意数据不崩：载荷被搜到，但列表本身不产生标签', () => {
    const evil = [make({
      id: 'evil', title: '<img src=x onerror=alert(1)>雨伞',
      location: '<b>地点</b>', description: '<script>alert(2)</script>'
    })];
    const out = listLike(evil, { q: '雨伞' });
    assert.strictEqual(out.length, 1);
    // 纯函数层不做渲染，只保证原样返回；渲染转义由 escapeHtml / highlight 负责（上面已测）
    assert.strictEqual(out[0].title, '<img src=x onerror=alert(1)>雨伞');
  });
});
