/**
 * plugins/todo/routes/widget.js
 *
 * Widget HTML page for the TODO panel.
 * Served as an iframe in the bottom-right corner of Hanako desktop.
 *
 * Features:
 * - Theme-aware via `hana-css` query parameter
 * - Collapsible panel with localStorage persistence
 * - Inline editing (double-click text)
 * - Drag-and-drop reorder (drag handle)
 * - XSS-safe rendering
 * - Responsive width (managed by desktop container)
 * - Scrollable list with height aligned to 笺 panel
 */

export default function (app, ctx) {
  // Health check — 验证路由是否注册成功
  app.get("/ping", (c) => c.text("pong"));

  // 极简测试版 — 先确认 iframe 能加载，再切回完整版
  app.get("/minimal", (c) => {
    const token = c.req.query("token") || "";
    const h = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { margin:0; padding:12px; font-family:sans-serif; font-size:13px;
        background:var(--jian-note-bg,#FAF5E9); color:var(--hana-text,#333); }
      h3 { margin:0 0 8px; font-size:14px; }
</style></head><body>
      <h3>TODO</h3>
      <p id="msg">testing...</p>
<script>
  parent.postMessage({type:"ready"},"*");
  var TOKEN = ${JSON.stringify(token)};
  if (TOKEN) {
    var _f = window.fetch.bind(window);
    window.fetch = function(url, o) {
      o = o || {}; o.headers = o.headers || {};
      o.headers["Authorization"] = "Bearer " + TOKEN;
      return _f(url, o);
    };
  }
  fetch("/api/plugins/todo/todos")
    .then(r=>r.json())
    .then(d=>{document.getElementById("msg").textContent="API OK, todos:"+d.todos.length;})
    .catch(e=>{document.getElementById("msg").textContent="API fail:"+e.message;});
</script>
</body></html>`;
    return c.html(h);
  });

  app.get("/widget", (c) => {
    try {
    const token = c.req.query("token") || "";
    const hanaCss = c.req.query("hana-css") || "";
    const pluginId = ctx.pluginId;
    const apiBase = `/api/plugins/${pluginId}`;
    const maxLen = 200; // must match MAX_TEXT_LENGTH in lib/store.js

    const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${hanaCss ? `<link rel="stylesheet" href="${escAttr(hanaCss)}">` : ""}
<style>
/* ── Reset & Base ──────────────────────────────── */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  height: 100%;
  overflow: hidden;
}

body {
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: var(--hana-text, #3B3D3F);
  background: var(--jian-note-bg, #FAF5E9);
  width: 100%;
  min-width: 180px;
  user-select: none;
}

/* ── Header ────────────────────────────────────── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-bottom: 1px solid var(--jian-note-border, rgba(180,160,130,0.12));
  cursor: default;
  flex-shrink: 0;
}
.header-title {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.02em;
}
.header-actions {
  display: flex;
  gap: 2px;
}
.header-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  color: var(--text-muted, #8E9196);
  cursor: pointer;
  font-size: 14px;
  border-radius: 4px;
  line-height: 1;
  transition: background 0.12s, color 0.12s;
}
.header-btn:hover {
  background: rgba(0,0,0,0.06);
  color: var(--hana-text, #3B3D3F);
}

/* ── List ──────────────────────────────────────── */
.list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.list::-webkit-scrollbar { width: 4px; }
.list::-webkit-scrollbar-thumb {
  background: var(--jian-note-border, rgba(180,160,130,0.2));
  border-radius: 2px;
}

/* ── Divider between undone / done ─────────────── */
.divider {
  height: 1px;
  margin: 4px 10px;
  background: var(--jian-note-border, rgba(180,160,130,0.12));
  display: none;
}
.divider.visible { display: block; }

/* ── Item ──────────────────────────────────────── */
.item {
  display: flex;
  align-items: flex-start;
  padding: 5px 8px 5px 4px;
  gap: 4px;
  border-bottom: 1px solid transparent;
  transition: background 0.12s;
  cursor: default;
}
.item:hover {
  background: rgba(0,0,0,0.025);
}

/* Drag handle */
.drag-handle {
  flex-shrink: 0;
  width: 14px;
  height: 20px;
  margin-top: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  color: var(--text-muted, #ccc);
  font-size: 11px;
  letter-spacing: -1px;
  opacity: 0;
  transition: opacity 0.12s;
  user-select: none;
}
.item:hover .drag-handle { opacity: 0.45; }
.item.done .drag-handle { visibility: hidden; }
.drag-handle:active { cursor: grabbing; }

/* Drag states */
.item.dragging { opacity: 0.4; background: var(--accent-light, rgba(83,125,150,0.08)); }
.item.drag-over {
  border-top: 2px solid var(--accent, #537D96);
  padding-top: 3px;
}

/* Checkbox */
.checkbox {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  border-radius: 3px;
  border: 1.5px solid var(--jian-note-border, rgba(180,160,130,0.3));
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: transparent;
  transition: all 0.15s;
}
.item.done .checkbox {
  background: var(--accent, #537D96);
  border-color: var(--accent, #537D96);
  color: #fff;
}

/* Text */
.item-text {
  flex: 1;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: break-word;
  cursor: pointer;
  padding: 1px 0;
}
.item.done .item-text {
  text-decoration: line-through;
  color: var(--text-muted, #999);
}

/* Delete button */
.delete-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-muted, #999);
  cursor: pointer;
  font-size: 13px;
  padding: 1px 3px;
  margin-top: 1px;
  opacity: 0;
  transition: opacity 0.12s;
  line-height: 1;
  border-radius: 3px;
}
.item:hover .delete-btn { opacity: 0.5; }
.delete-btn:hover { opacity: 1 !important; color: #c0392b; background: rgba(192,57,43,0.08); }

/* Inline edit input */
.edit-input {
  flex: 1;
  border: 1px solid var(--accent, #537D96);
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 13px;
  font-family: inherit;
  background: var(--bg-card, #fff);
  color: var(--hana-text, #3B3D3F);
  outline: none;
  min-width: 0;
}

/* ── Input Area ────────────────────────────────── */
.input-area {
  display: flex;
  padding: 6px 10px;
  gap: 8px;
  border-top: 1px solid var(--jian-note-border, rgba(180,160,130,0.12));
  flex-shrink: 0;
}
.input-area input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--jian-note-border, rgba(180,160,130,0.2));
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 13px;
  font-family: inherit;
  background: var(--bg-card, rgba(255,255,255,0.7));
  color: var(--hana-text, #3B3D3F);
  outline: none;
  transition: border-color 0.15s;
}
.input-area input:focus {
  border-color: var(--accent, #537D96);
}
.input-area input::placeholder {
  color: var(--text-muted, #bbb);
}
.input-area .char-count {
  font-size: 10px;
  color: var(--text-muted, #bbb);
  align-self: center;
  flex-shrink: 0;
  text-align: right;
}
.input-area .char-count:empty {
  display: none;
}
.input-area button {
  background: var(--accent, #537D96);
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s;
  flex-shrink: 0;
}
.input-area button:hover { filter: brightness(0.92); }
.input-area button:active { filter: brightness(0.85); }

/* ── Empty State ───────────────────────────────── */
.empty {
  padding: 24px 10px;
  text-align: center;
  color: var(--text-muted, #bbb);
  font-size: 12px;
  line-height: 1.8;
}

/* ── Collapsed State ───────────────────────────── */
body.collapsed .list,
body.collapsed .input-area { display: none; }
body.collapsed .header { border-bottom: none; }

/* ── Counting ──────────────────────────────────── */
.count {
  font-size: 10px;
  color: var(--text-muted, #bbb);
  font-weight: 400;
  margin-left: 6px;
}
</style>
</head>
<body>
<div class="header">
  <span class="header-title">
    待办<span class="count" id="count"></span>
  </span>
  <div class="header-actions">
    <button class="header-btn" id="btn-collapse" title="收起">\u2212</button>
  </div>
</div>
<div class="list" id="list"></div>
<div class="input-area">
  <input type="text" id="todo-input" placeholder="添加任务..." maxlength="${maxLen}" autocomplete="off">
  <span class="char-count" id="char-count"></span>
  <button id="btn-add">+</button>
</div>

<script>
(function() {
  "use strict";

  var API = ${JSON.stringify(apiBase)};
  var TOKEN = ${JSON.stringify(token)};
  // Inject auth token into all fetch calls
  if (TOKEN) {
    var _origFetch = window.fetch.bind(window);
    window.fetch = function(url, opts) {
      opts = opts || {};
      opts.headers = opts.headers || {};
      opts.headers["Authorization"] = "Bearer " + TOKEN;
      return _origFetch(url, opts);
    };
  }
  var MAX_LEN = ${maxLen};
  var collapsed = false;
  var dragId = null;

  // ── Helpers ──────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function notifyResize() {
    if (notifyResize._pending) return;
    notifyResize._pending = true;
    requestAnimationFrame(function() {
      notifyResize._pending = false;
      var h = collapsed
        ? document.querySelector(".header").scrollHeight + 2
        : document.body.scrollHeight;
      // Only send if height actually changed (ignore width-only changes from sidebar resize)
      if (h === notifyResize._lastH) return;
      notifyResize._lastH = h;
      parent.postMessage({
        type: "resize-request",
        payload: { height: h }
      }, "*");
    });
  }
  notifyResize._pending = false;
  notifyResize._lastH = 0;

  // ── Render ───────────────────────────────────────────────

  function buildItem(t, showDivider) {
    var text = esc(t.text);
    var doneClass = t.done ? " done" : "";
    var checkMark = t.done ? "&#10003;" : "";
    var draggable = t.done ? "" : ' draggable="true"';
    var html = '';
    if (showDivider) {
      html += '<div class="divider visible"></div>';
    }
    html += '<div class="item' + doneClass + '" data-id="' + escAttr(t.id) + '"' + draggable + '>';
    html += '<span class="drag-handle" title="拖拽排序">\u2261</span>';
    html += '<div class="checkbox" data-action="toggle">' + checkMark + '</div>';
    html += '<span class="item-text" data-action="edit">' + text + '</span>';
    html += '<button class="delete-btn" data-action="delete" title="删除">&times;</button>';
    html += '</div>';
    return html;
  }

  async function render() {
    var listEl = document.getElementById("list");
    var countEl = document.getElementById("count");
    try {
      var res = await fetch(API + "/todos");
      if (!res.ok) throw new Error("HTTP " + res.status);
      var data = await res.json();
      var todos = data.todos || [];

      var active = 0;
      for (var i = 0; i < todos.length; i++) {
        if (!todos[i].done) active++;
      }
      countEl.textContent = active > 0 ? "(" + active + ")" : "";

      if (todos.length === 0) {
        listEl.innerHTML = '<div class="empty">暂无待办。<br>在下方添加，或告诉 AI 来创建。</div>';
      } else {
        // Insert divider before first done item
        var html = "";
        var seenDone = false;
        for (var j = 0; j < todos.length; j++) {
          var t = todos[j];
          if (t.done && !seenDone) {
            seenDone = true;
            html += '<div class="divider visible"></div>';
          }
          html += buildItem(t, false);
        }
        listEl.innerHTML = html;
      }
    } catch (e) {
      listEl.innerHTML = '<div class="empty">加载失败</div>';
    }
    notifyResize();
  }

  // ── Drag & Drop ──────────────────────────────────────────

  document.getElementById("list").addEventListener("dragstart", function(e) {
    var item = e.target.closest(".item");
    if (!item || item.classList.contains("done")) {
      e.preventDefault();
      return;
    }
    dragId = item.dataset.id;
    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });

  document.getElementById("list").addEventListener("dragend", function(e) {
    var item = e.target.closest(".item");
    if (item) item.classList.remove("dragging");
    // Clear all drag-over indicators
    var overs = document.querySelectorAll(".drag-over");
    for (var i = 0; i < overs.length; i++) overs[i].classList.remove("drag-over");
    dragId = null;
  });

  document.getElementById("list").addEventListener("dragover", function(e) {
    e.preventDefault();
    if (!dragId) return;
    var item = e.target.closest(".item");
    if (!item || item.dataset.id === dragId) return;
    // Only allow dropping on undone items
    if (item.classList.contains("done")) return;
    // Clear previous indicators
    var overs = document.querySelectorAll(".drag-over");
    for (var i = 0; i < overs.length; i++) overs[i].classList.remove("drag-over");
    item.classList.add("drag-over");
  });

  document.getElementById("list").addEventListener("drop", async function(e) {
    e.preventDefault();
    if (!dragId) return;
    var targetItem = e.target.closest(".item");
    if (!targetItem || targetItem.dataset.id === dragId) return;
    if (targetItem.classList.contains("done")) return;

    // Count active items before target to find its index
    var allItems = document.querySelectorAll(".item:not(.done)");
    var targetIndex = 0;
    for (var i = 0; i < allItems.length; i++) {
      if (allItems[i] === targetItem) { targetIndex = i; break; }
    }

    try {
      await fetch(API + "/todos/" + encodeURIComponent(dragId) + "/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetIndex: targetIndex })
      });
    } catch (e) { /* silent */ }
    render();
  });

  // ── Event Delegation ─────────────────────────────────────

  document.getElementById("list").addEventListener("click", async function(e) {
    var action = e.target.dataset.action;
    var item = e.target.closest(".item");
    if (!item) return;
    var id = item.dataset.id;

    if (action === "toggle") {
      var done = !item.classList.contains("done");
      try {
        await fetch(API + "/todos/" + encodeURIComponent(id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: done })
        });
      } catch (e) { /* silent */ }
      render();
    }

    if (action === "delete") {
      try {
        await fetch(API + "/todos/" + encodeURIComponent(id), {
          method: "DELETE"
        });
      } catch (e) { /* silent */ }
      render();
    }
  });

  // ── Double-click to Edit ─────────────────────────────────

  document.getElementById("list").addEventListener("dblclick", function(e) {
    if (e.target.closest(".drag-handle")) return;
    var textEl = e.target.closest(".item-text");
    if (!textEl) return;
    var item = textEl.closest(".item");
    var id = item.dataset.id;
    var oldText = textEl.textContent;

    var input = document.createElement("input");
    input.type = "text";
    input.className = "edit-input";
    input.value = oldText;
    input.maxLength = MAX_LEN;
    textEl.replaceWith(input);
    input.focus();
    input.select();

    function finish() {
      var newText = input.value.trim();
      if (newText && newText !== oldText) {
        fetch(API + "/todos/" + encodeURIComponent(id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: newText })
        }).catch(function() {}).then(render);
      } else {
        render();
      }
    }

    input.addEventListener("blur", finish);
    input.addEventListener("keydown", function(ev) {
      if (ev.key === "Enter") { input.blur(); }
      if (ev.key === "Escape") { render(); }
    });
  });

  // ── Add TODO ─────────────────────────────────────────────

  async function doAdd() {
    var input = document.getElementById("todo-input");
    var text = input.value.trim();
    if (!text) return;
    if (text.length > MAX_LEN) return;

    try {
      var res = await fetch(API + "/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text })
      });
      if (!res.ok) {
        var err = await res.json().catch(function() { return {}; });
        if (err.error) { input.setCustomValidity(err.error); input.reportValidity(); return; }
      }
      input.value = "";
      updateCharCount();
      render();
    } catch (e) { /* silent */ }
  }

  document.getElementById("btn-add").addEventListener("click", doAdd);
  document.getElementById("todo-input").addEventListener("keydown", function(e) {
    if (e.key === "Enter") doAdd();
  });

  // ── Character Count ──────────────────────────────────────

  function updateCharCount() {
    var input = document.getElementById("todo-input");
    var count = document.getElementById("char-count");
    var len = input.value.length;
    if (len > 0) {
      count.textContent = len + "/" + MAX_LEN;
      if (len > MAX_LEN * 0.85) { count.style.color = "#c0392b"; }
      else { count.style.color = ""; }
    } else { count.textContent = ""; }
  }
  document.getElementById("todo-input").addEventListener("input", updateCharCount);

  // ── Collapse ─────────────────────────────────────────────

  try { collapsed = localStorage.getItem("todo-collapsed") === "1"; } catch(e) {}

  function applyCollapse() {
    document.body.classList.toggle("collapsed", collapsed);
    document.getElementById("btn-collapse").textContent = collapsed ? "+" : "\u2212";
    notifyResize();
  }

  document.getElementById("btn-collapse").addEventListener("click", function() {
    collapsed = !collapsed;
    try { localStorage.setItem("todo-collapsed", collapsed ? "1" : "0"); } catch(e) {}
    applyCollapse();
  });



  // ── Init ─────────────────────────────────────────────────

  loadThemeCSS();
  applyCollapse();
  render();

  // Handshake: must send {"type":"ready"} within 5s or parent shows "加载失败"
  parent.postMessage({ type: "ready" }, "*");

  if (window.ResizeObserver) {
    new ResizeObserver(notifyResize).observe(document.body);
  }

  // ── Theme CSS loader ─────────────────────────────────────
  // Clone parent's theme <style> directly (same-origin via allow-same-origin)
  var _lastThemeStyle = '';
  function loadThemeCSS() {
    try {
      var pDoc = window.parent.document;
      var src = pDoc.getElementById('theme-style');
      if (!src) { src = pDoc.querySelector('style[id*="theme"]'); }
      if (!src) return;
      var cssText = src.textContent || '';
      if (!cssText || cssText === _lastThemeStyle) return;
      _lastThemeStyle = cssText;
      var style = document.getElementById('widget-theme');
      if (!style) {
        style = document.createElement('style');
        style.id = 'widget-theme';
        document.head.insertBefore(style, document.querySelector('style'));
      }
      style.textContent = cssText;
    } catch(e) {}
  }

  // Poll every 5s — picks up AI changes AND theme changes
  var _pollTimer = setTimeout(function poll() {
    loadThemeCSS();
    render().catch(function(){}).then(function() {
      _pollTimer = setTimeout(poll, 5000);
    });
  }, 5000);
})();
</script>
</body>
</html>`;

    return c.html(html);
    } catch (err) {
      ctx.log.error("todo widget render error:", err.message, err.stack);
      return c.html(`<!DOCTYPE html><html><body><h1>Error</h1><pre>${err.message}</pre></body></html>`);
    }
  });
}

function escAttr(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
