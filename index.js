/**
 * plugins/todo/index.js
 *
 * TODO Plugin — Minimal lifecycle entry point.
 *
 * Tools (tools/) and routes (routes/) are auto-discovered by the Hanako
 * plugin manager; no manual registration needed here.
 *
 * This file only ensures the data directory and initial todos.json exist.
 */

import fs from "node:fs";
import path from "node:path";

export default class TodoPlugin {
  async onload() {
    const { dataDir, log } = this.ctx;

    // Ensure data directory
    fs.mkdirSync(dataDir, { recursive: true });

    // Seed an empty todos.json if it doesn't exist
    const storePath = path.join(dataDir, "todos.json");
    if (!fs.existsSync(storePath)) {
      fs.writeFileSync(storePath, JSON.stringify({ todos: [] }, null, 2), "utf-8");
    }

    log.info("todo plugin loaded");
  }
}
