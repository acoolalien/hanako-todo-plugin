/**
 * plugins/todo/tools/todo-list.js
 *
 * 列出 TODO 列表。
 * AI 可用此工具查看当前所有待办事项的状态。
 */

import { list } from "../lib/store.js";

export const name = "todo-list";
export const description =
  "List all TODO items from the shared task list. " +
  "Returns items sorted by creation time (newest first). " +
  "Use this to check what tasks are pending before adding new ones, " +
  "or to report task status to the user.";

export const promptGuidelines =
  "When to use todo-list:\n" +
  "- At the start of a session, to see what tasks are pending\n" +
  "- Before adding a new task, to avoid duplicates\n" +
  "- When the user asks 'what's on my TODO list?' or similar\n" +
  "- When reporting progress or summarizing completed work";

export const parameters = {
  type: "object",
  properties: {
    filter: {
      type: "string",
      enum: ["all", "active", "done"],
      description: "Filter: all (default), active (undone only), done (completed only)"
    }
  },
  required: []
};

export async function execute(input, ctx) {
  try {
    const todos = list(ctx.dataDir, input.filter || "all");
    if (todos.length === 0) {
      return {
        content: [{ type: "text", text: "No TODO items found." }]
      };
    }
    const lines = todos.map(t =>
      `${t.done ? "☑" : "☐"} [${t.id}] ${t.text}` +
      (t.done && t.doneAt ? ` (done ${t.doneAt.slice(0, 10)})` : "")
    );
    const header = `TODO (${todos.length} items):`;
    return {
      content: [{ type: "text", text: [header, ...lines].join("\n") }]
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Failed to list TODOs: ${err.message}` }]
    };
  }
}
