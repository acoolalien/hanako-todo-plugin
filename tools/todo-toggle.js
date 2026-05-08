/**
 * plugins/todo/tools/todo-toggle.js
 *
 * 切换 TODO 完成状态。
 * AI 完成任务后可标记完成，或重新打开已完成的 TODO。
 */

import { update, list } from "../lib/store.js";

export const name = "todo-toggle";
export const description =
  "Toggle a TODO item's completion status (done/undone). " +
  "Call this after completing a task, or to re-open a previously completed one. " +
  "Use todo-list first to find the item ID.";

export const promptGuidelines =
  "When to use todo-toggle:\n" +
  "- After you finish a task that was tracked in the TODO list\n" +
  "- When the user confirms a task is done\n" +
  "- To re-open a task that needs more work\n" +
  "\n" +
  "Always call todo-list first to confirm the item exists and get its ID.";

export const parameters = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "The TODO ID (obtained from todo-list)"
    },
    done: {
      type: "boolean",
      description: "Target state: true=mark done, false=mark undone. If omitted, toggles current state."
    }
  },
  required: ["id"]
};

export async function execute(input, ctx) {
  try {
    let targetDone = input.done;
    if (typeof targetDone !== "boolean") {
      const todos = list(ctx.dataDir);
      const found = todos.find(t => t.id === input.id);
      if (!found) {
        return { content: [{ type: "text", text: `TODO not found: ${input.id}` }] };
      }
      targetDone = !found.done;
    }

    const todo = update(ctx.dataDir, input.id, { done: targetDone });
    if (!todo) {
      return { content: [{ type: "text", text: `TODO not found: ${input.id}` }] };
    }
    const status = todo.done ? "Completed" : "Re-opened";
    return {
      content: [{ type: "text", text: `${status}: "${todo.text}"` }]
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Failed to toggle TODO: ${err.message}` }]
    };
  }
}
