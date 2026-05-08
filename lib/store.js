/**
 * plugins/todo/lib/store.js
 *
 * 数据层：todos.json 的读写封装。
 * 工具和路由共用此模块，保证数据格式一致、校验逻辑统一。
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ── 常量 ──────────────────────────────────────────────────

/** 单条 TODO 文本最大长度（字符数） */
const MAX_TEXT_LENGTH = 200;

/** 列表最大条数，防止无限膨胀 */
const MAX_TODOS = 500;

// ── 内部工具 ──────────────────────────────────────────────

function dataPath(dataDir) {
  return path.join(dataDir, "todos.json");
}

/**
 * 安全读取 todos.json。
 * 文件不存在或 JSON 损坏时返回空列表，不抛异常。
 */
function read(dataDir) {
  try {
    const raw = fs.readFileSync(dataPath(dataDir), "utf-8");
    if (!raw.trim()) return { todos: [] };
    const parsed = JSON.parse(raw);
    // 容错：非预期结构时降级为空列表
    if (!parsed || !Array.isArray(parsed.todos)) return { todos: [] };
    return parsed;
  } catch {
    return { todos: [] };
  }
}

/**
 * 原子写回。先写临时文件再 rename，避免写一半崩溃导致数据损坏。
 */
function write(dataDir, data) {
  const target = dataPath(dataDir);
  const tmp = target + ".tmp";
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, target);
  } catch (err) {
    // 清理临时文件
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw err;
  }
}

// ── 文本校验 ──────────────────────────────────────────────

/**
 * 清洗并校验 TODO 文本。
 * - 去除首尾空白
 * - 合并连续空白为单个空格
 * - 拒绝空文本
 * - 拒绝超长文本
 * - 移除控制字符（保留常用 Unicode）
 *
 * @throws {Error} 文本不合法
 * @returns {string} 清洗后的合法文本
 */
function sanitizeText(raw) {
  if (typeof raw !== "string") {
    throw new Error("TODO text must be a string");
  }
  // 去除首尾空白，合并连续空白
  let text = raw.trim().replace(/\s+/g, " ");
  // 移除换行符（TODO 应为单行）
  text = text.replace(/[\n\r]+/g, " ");
  // 移除除了常见标点外的控制字符
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // 再次 trim（控制字符替换可能产生多余空白）
  text = text.trim();

  if (!text) {
    throw new Error("TODO text cannot be empty");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`TODO text exceeds ${MAX_TEXT_LENGTH} characters (got ${text.length})`);
  }
  return text;
}

// ── 公开 API ──────────────────────────────────────────────

/** 生成 8 位 hex ID */
export function genId() {
  return crypto.randomBytes(4).toString("hex");
}

/**
 * 排序键：优先用 order 字段，降级到 createdAt 时间戳。
 * order 不存在或相等时以 createdAt 区分，保证稳定排序。
 */
function sortKey(t) {
  const o = typeof t.order === "number" ? t.order : Date.parse(t.createdAt || 0);
  return isNaN(o) ? 0 : o;
}

/**
 * 列出 TODO。
 * 排序规则：未完成在上（正序），已完成在下（正序）。
 * 新建条目排在未完成区域最底部。
 *
 * @param {string} dataDir 插件数据目录
 * @param {"all"|"active"|"done"} filter
 */
export function list(dataDir, filter = "all") {
  const data = read(dataDir);
  let todos = data.todos;
  if (filter === "active") todos = todos.filter(t => !t.done);
  if (filter === "done")   todos = todos.filter(t => t.done);
  // 先按 done 分组（false 在前），组内按 order 正序
  return todos.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return sortKey(a) - sortKey(b);
  });
}

/**
 * 添加一条 TODO。
 * @returns {object} 新创建的 TODO 对象
 * @throws {Error} 文本不合法或列表已满
 */
export function add(dataDir, rawText) {
  const text = sanitizeText(rawText);
  const data = read(dataDir);

  if (data.todos.length >= MAX_TODOS) {
    throw new Error(`TODO list is full (max ${MAX_TODOS} items)`);
  }

  const todo = {
    id: genId(),
    text,
    done: false,
    order: Date.now(),
    createdAt: new Date().toISOString(),
    doneAt: null
  };
  data.todos.push(todo);
  write(dataDir, data);
  return todo;
}

/**
 * 更新 TODO 的 text 和/或 done 状态。
 * @param {object} fields - { text?, done? }
 * @returns {object|null} 更新后的 TODO，未找到返回 null
 * @throws {Error} 文本不合法
 */
export function update(dataDir, id, fields) {
  const data = read(dataDir);
  const todo = data.todos.find(t => t.id === id);
  if (!todo) return null;

  if ("text" in fields) {
    todo.text = sanitizeText(fields.text);
  }
  if ("done" in fields) {
    todo.done = Boolean(fields.done);
    todo.doneAt = todo.done ? new Date().toISOString() : null;
  }

  write(dataDir, data);
  return todo;
}

/**
 * 删除一条 TODO。
 * @returns {boolean} 是否成功删除
 */
export function remove(dataDir, id) {
  const data = read(dataDir);
  const idx = data.todos.findIndex(t => t.id === id);
  if (idx === -1) return false;
  data.todos.splice(idx, 1);
  write(dataDir, data);
  return true;
}

/**
 * 拖拽排序：将指定 TODO 移动到新位置。
 * 重新分配所有未隐藏项的 order 值。
 *
 * @param {string} dataDir
 * @param {string} id - 被拖拽的 TODO ID
 * @param {number} targetIndex - 目标位置（在未完成列表中的索引）
 * @returns {boolean}
 */
export function reorder(dataDir, id, targetIndex) {
  const data = read(dataDir);
  const activeIdx = data.todos.findIndex(t => t.id === id);
  if (activeIdx === -1) return false;

  // 拆出未完成和已完成
  const undone = data.todos.filter(t => !t.done);
  const done = data.todos.filter(t => t.done);

  // 从未完成列表中移除被拖拽项
  const item = undone.find(t => t.id === id);
  if (!item) return false;
  const oldIdx = undone.indexOf(item);
  undone.splice(oldIdx, 1);

  // 插入到目标位置
  const clamped = Math.max(0, Math.min(targetIndex, undone.length));
  undone.splice(clamped, 0, item);

  // 重分配 order：用较大步长避免浮点精度问题
  const step = 1000;
  undone.forEach((t, i) => { t.order = (i + 1) * step; });

  // 合并写回
  data.todos = [...undone, ...done];
  write(dataDir, data);
  return true;
}

export { MAX_TEXT_LENGTH, MAX_TODOS };
