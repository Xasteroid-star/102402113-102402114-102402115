/* api.js —— 前端 fetch 封装（浏览器端，调用后端 /api/...）
 * 依赖：无。B/C 各页面统一用 API.list/get/publish/resolve，避免重复写 fetch。
 */
(function (root) {
  'use strict';

  function toQuery(params) {
    const qs = [];
    Object.keys(params || {}).forEach(function (k) {
      const v = params[k];
      if (v === undefined || v === null || v === '') return;
      qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return qs.length ? '?' + qs.join('&') : '';
  }

  async function request(method, url, body) {
    const opt = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opt.body = JSON.stringify(body);

    // fetch 只在「根本没连上」时 reject（后端没启动 / 断网 / DNS 失败），
    // 这里统一翻译成中文，避免各页面把 "Failed to fetch" 直接抛给用户。
    let res;
    try {
      res = await fetch(url, opt);
    } catch (e) {
      const err = new Error('网络异常，请稍后重试');
      err.offline = true;
      throw err;
    }

    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error) || ('请求失败（HTTP ' + res.status + '）'));
      err.status = res.status;
      err.errors = data && data.errors;
      throw err;
    }
    return data;
  }

  const API = {
    // 列表：type/category/q/sort/publisher/status
    list: function (params) { return request('GET', '/api/items' + toQuery(params)); },
    // 详情
    get: function (id) { return request('GET', '/api/items/' + encodeURIComponent(id)); },
    // 发布
    publish: function (item) { return request('POST', '/api/items', item); },
    // 更新状态（标记已找到/已归还）
    resolve: function (id) { return request('PATCH', '/api/items/' + encodeURIComponent(id), { status: 'resolved' }); }
  };

  root.API = API;
})(typeof window !== 'undefined' ? window : this);
