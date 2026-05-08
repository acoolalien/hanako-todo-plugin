/**
 * plugins/todo/tools/todo-delete.js
 *
 * 删除一条 TODO。
 * AI 在任务取消或判断不再需要时调用。
 */

import { remove } from "../lib/store.js";

export const name = "todo-delete";
export const description =
  "Delete a TODO item from the shared list. " +
  "Use this when a task is cancelled, no longer relevant, or was added by mistake. " +
  "Use todo-list first to find the item ID.";

export const promptGuidelines =
  "When to use todo-delete:\n" +
  "- The user says a task is cancelled or no longer needed\n" +
  "- A task was added by mistake\n" +
  "- Cleaning up completed tasks at the user's request\n" +
  "\n" +
  "Be cautious — deletion is permanent. Confirm with the user if unsure.";

export const parameters = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "The TODO ID to delete (obtained from todo-list)"
    }
  },
  required: ["id"]
};

export async function execute(input, ctx) {
  try {
    const ok = remove(ctx.dataDir, input.id);
    if (!ok) {
      return { content: [{ type: "text", text: `TODO not found: ${input.id}` }] };
    }
    return {
      content: [{ type: "text", text: `Deleted TODO: ${input.id}` }]
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Failed to delete TODO: ${err.message}` }]
    };
  }
}
