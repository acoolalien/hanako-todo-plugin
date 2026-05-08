/**
 * plugins/todo/routes/api.js
 *
 * REST API for the TODO widget panel.
 * Mounted at /api/plugins/todo/api/*
 */

import { list, add, update, remove, reorder, MAX_TEXT_LENGTH } from "../lib/store.js";

export default function (app, ctx) {
  const dataDir = ctx.dataDir;

  // ── GET /api/plugins/todo/api/todos ──────────────────────
  app.get("/todos", (c) => {
    try {
      const filter = c.req.query("filter") || "all";
      if (!["all", "active", "done"].includes(filter)) {
        return c.json({ error: "Invalid filter. Use all, active, or done." }, 400);
      }
      const todos = list(dataDir, filter);
      return c.json({ todos });
    } catch (err) {
      ctx.log.error("todo/api GET /todos:", err.message);
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // ── POST /api/plugins/todo/api/todos ─────────────────────
  app.post("/todos", async (c) => {
    try {
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body.text !== "string") {
        return c.json({ error: "Field 'text' is required and must be a string." }, 400);
      }

      const todo = add(dataDir, body.text);
      return c.json({ todo }, 201);
    } catch (err) {
      if (err.message.includes("cannot be empty") ||
          err.message.includes("exceeds") ||
          err.message.includes("is full")) {
        return c.json({ error: err.message }, 400);
      }
      ctx.log.error("todo/api POST /todos:", err.message);
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // ── PATCH /api/plugins/todo/api/todos/:id ────────────────
  app.patch("/todos/:id", async (c) => {
    try {
      const id = c.req.param("id");
      if (!id || id.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return c.json({ error: "Invalid ID format." }, 400);
      }

      const body = await c.req.json().catch(() => null);
      if (!body || (body.text === undefined && body.done === undefined)) {
        return c.json({ error: "At least one of 'text' or 'done' is required." }, 400);
      }

      const fields = {};
      if ("text" in body) {
        if (typeof body.text !== "string") {
          return c.json({ error: "Field 'text' must be a string." }, 400);
        }
        fields.text = body.text;
      }
      if ("done" in body) {
        fields.done = Boolean(body.done);
      }

      const todo = update(dataDir, id, fields);
      if (!todo) {
        return c.json({ error: "TODO not found." }, 404);
      }
      return c.json({ todo });
    } catch (err) {
      if (err.message.includes("cannot be empty") ||
          err.message.includes("exceeds")) {
        return c.json({ error: err.message }, 400);
      }
      ctx.log.error("todo/api PATCH /todos/:id:", err.message);
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // ── PUT /api/plugins/todo/api/todos/:id/reorder ─────────
  app.put("/todos/:id/reorder", async (c) => {
    try {
      const id = c.req.param("id");
      if (!id || id.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return c.json({ error: "Invalid ID format." }, 400);
      }
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body.targetIndex !== "number") {
        return c.json({ error: "Field 'targetIndex' (number) is required." }, 400);
      }
      const ok = reorder(dataDir, id, body.targetIndex);
      if (!ok) {
        return c.json({ error: "TODO not found or not in active list." }, 404);
      }
      return c.json({ ok: true });
    } catch (err) {
      ctx.log.error("todo/api PUT /todos/:id/reorder:", err.message);
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // ── DELETE /api/plugins/todo/api/todos/:id ───────────────
  app.delete("/todos/:id", (c) => {
    try {
      const id = c.req.param("id");
      if (!id || id.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return c.json({ error: "Invalid ID format." }, 400);
      }

      const ok = remove(dataDir, id);
      if (!ok) {
        return c.json({ error: "TODO not found." }, 404);
      }
      return c.json({ ok: true });
    } catch (err) {
      ctx.log.error("todo/api DELETE /todos/:id:", err.message);
      return c.json({ error: "Internal error" }, 500);
    }
  });
}
