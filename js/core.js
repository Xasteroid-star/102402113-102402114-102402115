/* core.js —— 纯函数逻辑（无 DOM / 无网络 / 无文件），前后端共用
 *
 * 浏览器：<script src="js/core.js"> 后使用全局 Core
 * Node：  const Core = require('./js/core.js')
 *
 * 这是整个项目可测试性的根基：后端 server.js 和前端页面复用同一套
 * 搜索 / 筛选 / 排序 / 校验逻辑，单元测试也只需 require 本文件。
 */
(function (root) {
  'use strict';

  // 按关键词搜索：在物品名称 + 详细描述中模糊匹配（忽略大小写、去首尾空格）
  function searchItems(items, kw) {
    const q = String(kw == null ? '' : kw).trim().toLowerCase();
    if (!q) return items.slice();
    return items.filter(function (it) {
      const title = String(it.title == null ? '' : it.title).toLowerCase();
      const desc = String(it.description == null ? '' : it.description).toLowerCase();
      return title.indexOf(q) !== -1 || desc.indexOf(q) !== -1;
    });
  }

  // 组合筛选
  //   opts.type       'lost' | 'found'
  //   opts.category   物品分类
  //   opts.status     'active' 只保留进行中（自动下架）；'all'/空 保留全部
  //   opts.publisher  发布者匿名 uid
  function filterItems(items, opts) {
    opts = opts || {};
    return items.filter(function (it) {
      if (opts.type && it.type !== opts.type) return false;
      if (opts.category && it.category !== opts.category) return false;
      if (opts.status === 'active' && it.status !== 'active') return false;
      if (opts.publisher && it.publisher !== opts.publisher) return false;
      return true;
    });
  }

  // 排序：'newest' 最新发布倒序（其余保持原顺序）
  function sortItems(items, sort) {
    const arr = items.slice();
    if (sort === 'newest') {
      arr.sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }
    return arr;
  }

  // HTML 转义（所有用户输入渲染前必须先经过这里）
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 关键词高亮：先按关键词把原文切开，再逐段转义并包裹 <mark>，防止关键词注入 XSS。
  // 不能写成「先整体转义、再在转义结果里 replace」——那样插入的 <mark> 会落在
  // HTML 实体中间，把 &#39; 劈成 &#3<mark>9</mark>; ，实体失效后用户看到的是转义原文。
  function highlight(text, kw) {
    const raw = String(text == null ? '' : text);
    const q = String(kw == null ? '' : kw).trim();
    if (!q) return escapeHtml(raw);
    const qEsc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 捕获组让 split 把命中的关键词留在结果的奇数下标上
    return raw.split(new RegExp('(' + qEsc + ')', 'gi')).map(function (part, i) {
      return i % 2 ? '<mark>' + escapeHtml(part) + '</mark>' : escapeHtml(part);
    }).join('');
  }

  // 发布表单字段长度上限（前后端共用，拦住超长内容污染列表与详情页）
  const LIMITS = { title: 40, location: 60, time: 40, contact: 60, description: 300 };

  // 校验发布表单：返回 { ok, errors }，errors 键对应字段名（前端逐项回填、后端 400 复用）
  function validatePublish(form) {
    const errors = {};
    form = form || {};
    const str = function (v) { return String(v == null ? '' : v).trim(); };
    const title = str(form.title);
    const contact = str(form.contact);
    const category = str(form.category);
    const location = str(form.location);
    const time = str(form.time);
    const description = str(form.description);

    if (!title) errors.title = '请填写物品名称';
    else if (title.length > LIMITS.title) errors.title = '物品名称不超过 ' + LIMITS.title + ' 个字';

    if (!contact) errors.contact = '请填写联系方式';
    else if (contact.length > LIMITS.contact) errors.contact = '联系方式不超过 ' + LIMITS.contact + ' 个字符';

    if (form.type !== 'lost' && form.type !== 'found') errors.type = '请选择寻物或招领';

    if (!category) errors.category = '请选择物品分类';

    if (!location) errors.location = '请填写地点';
    else if (location.length > LIMITS.location) errors.location = '地点不超过 ' + LIMITS.location + ' 个字';

    if (!time) errors.time = '请填写时间';
    else if (time.length > LIMITS.time) errors.time = '时间不超过 ' + LIMITS.time + ' 个字';

    if (description.length > LIMITS.description) errors.description = '详细描述不超过 ' + LIMITS.description + ' 个字';

    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  // 状态文案：寻物→已找到，招领→已归还
  function resolvedLabel(type) {
    return type === 'lost' ? '已找到' : '已归还';
  }

  const Core = {
    LIMITS: LIMITS,
    searchItems: searchItems,
    filterItems: filterItems,
    sortItems: sortItems,
    escapeHtml: escapeHtml,
    highlight: highlight,
    validatePublish: validatePublish,
    resolvedLabel: resolvedLabel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Core;
  } else {
    root.Core = Core;
  }
})(typeof window !== 'undefined' ? window : this);
