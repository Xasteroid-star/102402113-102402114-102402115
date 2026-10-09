/* api.js —— 前端数据层（localStorage 本地持久化，无后端）
 * 依赖：Core（js/core.js）、SEED_ITEMS（js/seed.js）
 *
 * 对外接口与原先 fetch 版完全一致：API.list / get / publish / resolve 都返回 Promise，
 * 5 个页面零改动。数据存浏览器 localStorage 的 'items' 键，首次打开自动灌入种子数据。
 * 搜索/筛选/排序/校验仍复用 Core 里的纯函数，保证逻辑与单元测试一致。
 */
(function (root) {
  'use strict';

  var KEY = 'items';

  // ---- 底层读写（localStorage）----
  function readAll() {
    var arr = null;
    try { arr = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { arr = null; }
    if (Array.isArray(arr)) return arr;
    // 首次打开或数据损坏：写入种子演示数据
    var seed = (root.SEED_ITEMS && Array.isArray(root.SEED_ITEMS)) ? root.SEED_ITEMS : [];
    try { localStorage.setItem(KEY, JSON.stringify(seed)); } catch (e) { /* 隐私模式等写不进时退回内存种子 */ }
    return seed.slice();
  }

  function writeAll(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); }
    catch (e) { /* 忽略写入失败 */ }
  }

  function genId() {
    return 't' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // 构造与原来后端一致结构的错误（页面 catch 里依赖 e.message / e.errors）
  function fail(message, extra) {
    var e = new Error(message);
    if (extra) {
      if (extra.status) e.status = extra.status;
      if (extra.errors) e.errors = extra.errors;
    }
    return e;
  }

  var API = {
    // 列表：type/category/q/sort/publisher/status（语义与原 GET /api/items 一致）
    list: function (params) {
      params = params || {};
      var result = Core.searchItems(readAll(), params.q);
      result = Core.filterItems(result, {
        type: params.type,
        category: params.category,
        status: params.status || 'active',
        publisher: params.publisher
      });
      result = Core.sortItems(result, params.sort || 'newest');
      return Promise.resolve(result);
    },

    // 详情
    get: function (id) {
      var item = readAll().filter(function (it) { return it.id === id; })[0];
      if (!item) return Promise.reject(fail('未找到该条信息', { status: 404 }));
      return Promise.resolve(item);
    },

    // 发布：复用 Core.validatePublish 二次校验（errors 结构与原后端 400 一致）
    publish: function (body) {
      var v = Core.validatePublish(body);
      if (!v.ok) return Promise.reject(fail('请完整填写必填项', { status: 400, errors: v.errors }));
      var item = {
        id: genId(),
        type: body.type,
        title: String(body.title).trim(),
        category: String(body.category).trim(),
        location: String(body.location).trim(),
        time: String(body.time).trim(),
        description: String(body.description == null ? '' : body.description).trim(),
        contact: String(body.contact).trim(),
        image: String(body.image == null ? '' : body.image),
        status: 'active',
        publisher: String(body.publisher == null ? '' : body.publisher),
        publisherName: String(body.publisherName == null ? '' : body.publisherName).trim(),
        dept: String(body.dept == null ? '' : body.dept).trim(),
        createdAt: Date.now()
      };
      var items = readAll();
      items.unshift(item);
      writeAll(items);
      return Promise.resolve(item);
    },

    // 更新状态（标记已找到/已归还 → 自动下架）
    resolve: function (id) {
      var items = readAll();
      var item = items.filter(function (it) { return it.id === id; })[0];
      if (!item) return Promise.reject(fail('未找到该条信息', { status: 404 }));
      item.status = 'resolved';
      writeAll(items);
      return Promise.resolve(item);
    }
  };

  root.API = API;
})(typeof window !== 'undefined' ? window : this);
