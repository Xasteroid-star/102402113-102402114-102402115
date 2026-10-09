/* tests/api.test.js —— js/api.js 数据层单元测试（localStorage 版）
 *
 * 运行：npm test        等价于 node --test 通配 tests 目录下所有 .test.js（见 package.json 的 test 脚本）
 *
 * 为什么单独测这一层？
 * 「同学下载全部文件后，用 Chrome 直接打开 index.html 就能看到预期结果」这件事，
 * 成败全在 js/api.js —— 它负责读写浏览器 localStorage、首次灌入种子数据、
 * 以及在发布/标记时复用 Core 的校验与状态规则。core.test.js 只覆盖纯函数，
 * 这一层此前没有任何测试，所以另开本文件。
 *
 * 怎么在 Node 里跑浏览器代码？三步：
 *   1) 把 core.js 挂到 global.Core（页面里它是 window.Core）；
 *   2) 用内存 Map 造一个 localStorage 桩（浏览器里它是 window.localStorage）；
 *   3) require('../js/api.js') —— 它在 Node 下把 API 挂到 module.exports 上。
 * 于是可以在不起服务、不开浏览器的情况下，直接对真实数据层下断言。
 */
'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// ---- 1) 浏览器侧的全局依赖，用 Node 侧的等价物顶上 ----
global.Core = require('../js/core.js');
const seedMod = require('../js/seed.js');

const store = new Map();
global.localStorage = {
  getItem: function (k) { return store.has(k) ? store.get(k) : null; },
  setItem: function (k, v) { store.set(k, String(v)); },
  removeItem: function (k) { store.delete(k); }
};

const apiMod = require('../js/api.js');
// api.js 里读的是它自己那个 IIFE 的 root.SEED_ITEMS（浏览器下即 window.SEED_ITEMS，
// Node 下即本模块的 exports），所以这里手动对接一次 seed.js。
apiMod.SEED_ITEMS = seedMod.SEED_ITEMS;

const API = apiMod.API;
const SEED = seedMod.SEED_ITEMS;

const KEY = 'items';
const readStore = function () { return JSON.parse(store.get(KEY)); };
// 直接篡改「磁盘」，模拟上一轮留下的数据（与 readAll 走 JSON 往返一致）
const setStore = function (arr) { store.set(KEY, JSON.stringify(arr)); };

// 每个用例前清空 localStorage，保证互不污染
beforeEach(function () { store.clear(); });

/* 造一条合法条目（结构与 api.js 落库的一致） */
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
    image: '',
    status: 'active',
    publisher: 'u-1',
    publisherName: '',
    dept: '',
    createdAt: 1000
  }, over || {});
}

/* ============================================================
 * 种子数据初始化 —— 这是「双击打开就有 10 条演示数据」的实现
 * ============================================================ */
describe('种子初始化（首次打开自动灌数据）', () => {
  test('首次读取时自动写入 10 条种子数据', async () => {
    assert.strictEqual(store.has(KEY), false, '前置：localStorage 里还没有 items');
    const items = await API.list({});
    assert.strictEqual(items.length, 10, '应拿到 10 条种子数据');
    assert.strictEqual(readStore().length, 10, '并已落盘到 localStorage，供后续读取');
  });

  test('种子全部是「进行中」，不携带发布者 uid（不属于任何本机用户）', async () => {
    const items = await API.list({});
    assert.ok(items.every((it) => it.status === 'active'), '种子条目都应是 active');
    assert.ok(items.every((it) => it.publisher === ''), '种子条目的 publisher 应为空');
  });

  test('数据损坏（localStorage 里是坏 JSON）时不抛异常，退回种子数据', async () => {
    store.set(KEY, '{ 这不是合法 JSON');
    const items = await API.list({});
    assert.strictEqual(items.length, 10, '应退回种子而不是崩掉或白屏');
  });

  test('已有合法数据时不被种子覆盖（保住用户自己发布的内容）', async () => {
    setStore([make({ id: 'mine', title: '我发布的东西' })]);
    const items = await API.list({ status: 'all' });
    assert.deepStrictEqual(items.map((i) => i.id), ['mine']);
  });
});

/* ============================================================
 * API.list —— 首页 / 搜索页 / 我的发布共用的取数入口
 * ============================================================ */
describe('API.list 列表与「自动下架」语义', () => {
  test('不传 status 时默认只返回进行中（已解决的自动下架）', async () => {
    setStore([make({ id: 'a' }), make({ id: 'b', status: 'resolved' })]);
    const items = await API.list({});
    assert.deepStrictEqual(items.map((i) => i.id), ['a']);
  });

  test('status=all 时已解决条目回来（「我的发布」要看历史）', async () => {
    setStore([make({ id: 'a' }), make({ id: 'b', status: 'resolved' })]);
    const items = await API.list({ status: 'all' });
    assert.strictEqual(items.length, 2);
    assert.ok(items.some((i) => i.id === 'b'));
  });

  test('按 type / category 组合筛选（条件取交集）', async () => {
    setStore([
      make({ id: 'key', type: 'lost', category: '钥匙' }),
      make({ id: 'card', type: 'found', category: '证件卡类' }),
      make({ id: 'umb', type: 'found', category: '雨伞' })
    ]);
    assert.deepStrictEqual((await API.list({ type: 'found' })).map((i) => i.id), ['card', 'umb']);
    assert.deepStrictEqual((await API.list({ type: 'lost', category: '钥匙' })).map((i) => i.id), ['key']);
    assert.deepStrictEqual(await API.list({ type: 'lost', category: '雨伞' }), []);
  });

  test('按 publisher 筛选，「我的发布」只取本机 uid 的条目', async () => {
    setStore([
      make({ id: 'mine', publisher: 'u-me' }),
      make({ id: 'other', publisher: 'u-other' }),
      make({ id: 'seed', publisher: '' })
    ]);
    assert.deepStrictEqual((await API.list({ publisher: 'u-me', status: 'all' })).map((i) => i.id), ['mine']);
    // 换个 uid 只看到自己的 ⇒ 确实按 publisher 命中了，而不是「谁都能拿到全部」
    assert.deepStrictEqual((await API.list({ publisher: 'u-other', status: 'all' })).map((i) => i.id), ['other']);
    // 种子条目 publisher 是空串，只会出现在「不按 publisher 过滤」的查询里。
    // filterItems 把空串当「未传」处理（与 type / category / status 一致），所以这里等于不筛选，返回全部 3 条。
    assert.strictEqual((await API.list({ publisher: '', status: 'all' })).length, 3);
  });

  test('关键词 q 命中标题与描述（复用 Core.searchItems）', async () => {
    setStore([
      make({ id: 'byTitle', title: '捡到一张校园卡' }),
      make({ id: 'byDesc', title: '无关标题', description: '描述里提到了校园卡' }),
      make({ id: 'none', title: '雨伞', description: '黑色折叠伞' })
    ]);
    assert.deepStrictEqual((await API.list({ q: '校园卡' })).map((i) => i.id), ['byTitle', 'byDesc']);
  });

  test('默认按 createdAt 倒序，最新的在最前（首页「最新发布」）', async () => {
    setStore([
      make({ id: 'old', createdAt: 1000 }),
      make({ id: 'new', createdAt: 3000 }),
      make({ id: 'mid', createdAt: 2000 })
    ]);
    assert.deepStrictEqual((await API.list({})).map((i) => i.id), ['new', 'mid', 'old']);
  });

  test('空库返回空数组而不是报错', async () => {
    setStore([]);
    assert.deepStrictEqual(await API.list({}), []);
    assert.deepStrictEqual(await API.list({ q: '校园卡', type: 'lost' }), []);
  });
});

/* ============================================================
 * API.get —— 详情页
 * ============================================================ */
describe('API.get 详情', () => {
  test('按 id 取到条目', async () => {
    setStore([make({ id: 'hit', title: '捡到一张校园卡' })]);
    const it = await API.get('hit');
    assert.strictEqual(it.title, '捡到一张校园卡');
  });

  test('id 不存在时 reject，并带 404 与中文提示', async () => {
    setStore([make({ id: 'hit' })]);
    await assert.rejects(() => API.get('nope'), (e) => {
      assert.strictEqual(e.message, '未找到该条信息');
      assert.strictEqual(e.status, 404);
      return true;
    });
  });
});

/* ============================================================
 * API.publish —— 发布（校验不通过必须原样挡在门外）
 * ============================================================ */
describe('API.publish 发布', () => {
  test('空表单 → reject，errors 覆盖全部必填项，且一条都不入库', async () => {
    await assert.rejects(() => API.publish({}), (e) => {
      assert.strictEqual(e.status, 400);
      assert.deepStrictEqual(
        Object.keys(e.errors).sort(),
        ['category', 'contact', 'location', 'time', 'title', 'type']
      );
      return true;
    });
    assert.strictEqual(store.has(KEY), false, '校验失败不能写 localStorage');
  });

  test('合法表单 → 落库，status 为 active，id / createdAt / publisher 正确', async () => {
    // 显式给一个「已初始化但为空」的库：beforeEach 的 store.clear() 抹掉 items 键后，
    // readAll 会把 10 条种子灌进来，就数不清这次发布到底新增了几条。
    // setStore([]) 写的是合法空数组，readAll 认它是数组 ⇒ 不补种子。
    setStore([]);
    const before = Date.now();
    const it = await API.publish(make({
      id: undefined, status: undefined, createdAt: undefined,
      type: 'found', title: '捡到一串钥匙', category: '钥匙',
      location: '一食堂二楼', time: '2026-10-09 12:00', contact: 'wx_me', publisher: 'u-me'
    }));

    assert.strictEqual(it.status, 'active', '新发布的条目应是进行中');
    assert.strictEqual(it.publisher, 'u-me');
    assert.ok(/^t/.test(it.id), 'id 应以 t 开头（genId）');
    assert.ok(it.createdAt >= before && it.createdAt <= Date.now(), 'createdAt 应是当前时间');

    const stored = readStore();
    assert.strictEqual(stored.length, 1, '已写入 localStorage');
    assert.strictEqual(stored[0].id, it.id, '新条目排在数组最前');
    assert.strictEqual(stored[0].title, '捡到一串钥匙');
  });

  test('标题 / 地点 / 联系方式入库前去掉首尾空格', async () => {
    await API.publish(make({ title: '  校园卡  ', location: ' 三教 201 ', contact: '  wx_me  ' }));
    const stored = readStore()[0];
    assert.strictEqual(stored.title, '校园卡');
    assert.strictEqual(stored.location, '三教 201');
    assert.strictEqual(stored.contact, 'wx_me');
  });

  test('描述是选填：不填也能发布', async () => {
    setStore([]);
    const it = await API.publish(make({ description: '' }));
    assert.strictEqual(it.description, '');
    assert.strictEqual(readStore().length, 1);
  });

  test('恶意：超过长度上限的载荷被拦下，一条都不入库', async () => {
    const L = Core.LIMITS;
    await assert.rejects(
      () => API.publish(make({ title: '<img>'.repeat(500) })),
      (e) => {
        assert.strictEqual(e.errors.title, '物品名称不超过 ' + L.title + ' 个字');
        return true;
      }
    );
    assert.strictEqual(store.has(KEY), false, '超长内容不能被放行入库');
  });
});

/* ============================================================
 * API.resolve —— 标记已找到 / 已归还
 * ============================================================ */
describe('API.resolve 状态更新', () => {
  test('标记后状态变为 resolved，并且持久化（重新读取仍在）', async () => {
    setStore([make({ id: 'a' }), make({ id: 'b' })]);
    const it = await API.resolve('a');
    assert.strictEqual(it.status, 'resolved');
    const persisted = readStore().filter((x) => x.id === 'a')[0];
    assert.strictEqual(persisted.status, 'resolved', '必须写回 localStorage，不能只改内存');
    assert.strictEqual(readStore().filter((x) => x.id === 'b')[0].status, 'active', '不能误伤其他条目');
  });

  test('id 不存在时 reject 404，且不改动任何数据', async () => {
    setStore([make({ id: 'a' })]);
    await assert.rejects(() => API.resolve('nope'), (e) => e.status === 404);
    assert.deepStrictEqual(readStore().map((i) => i.status), ['active']);
  });

  test('重复标记同一条不报错（幂等）', async () => {
    setStore([make({ id: 'a' })]);
    await API.resolve('a');
    await API.resolve('a');
    assert.strictEqual(readStore()[0].status, 'resolved');
  });
});

/* ============================================================
 * 闭环 —— 复刻真实操作顺序：发布 → 首页可见 → 标记 → 自动下架
 * 这一段替代了「靠一个函数手抄一遍取数逻辑」的旧做法，直接打真实数据层。
 * ============================================================ */
describe('闭环：发布 → 浏览 → 标记 → 自动下架', () => {
  test('新发布的条目先进首页，标记后从首页消失但在「我的发布」仍在', async () => {
    setStore([]);
    const published = await API.publish(make({
      title: '测试用黑色雨伞', type: 'found', category: '雨伞', publisher: 'u-me'
    }));

    // 1) 首页（不传 status）能看到
    let home = await API.list({});
    assert.ok(home.some((i) => i.id === published.id), '刚发布应在首页可见');

    // 2) 标记已归还
    await API.resolve(published.id);

    // 3) 首页看不到了（自动下架）
    home = await API.list({});
    assert.ok(!home.some((i) => i.id === published.id), '已解决条目必须从首页消失');

    // 4) 但「我的发布」显式要 all，历史记录一条不少
    const mine = await API.list({ publisher: 'u-me', status: 'all' });
    assert.strictEqual(mine.length, 1);
    assert.strictEqual(mine[0].status, 'resolved');
  });

  test('搜索也遵循同一条下架规则（已解决的搜不到）', async () => {
    // 清掉种子：种子里本身就有一条「黑色雨伞」，不清的话它会混进搜索结果
    setStore([]);
    const published = await API.publish(make({
      title: '测试用黑色雨伞', description: '', publisher: 'u-me'
    }));
    assert.deepStrictEqual((await API.list({ q: '黑色雨伞' })).map((i) => i.id), [published.id]);
    await API.resolve(published.id);
    assert.deepStrictEqual(await API.list({ q: '黑色雨伞' }), []);
  });
});
