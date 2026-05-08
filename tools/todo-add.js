/**
 * plugins/todo/tools/todo-add.js
 *
 * 添加一条 TODO 到共享任务列表。
 * AI 可在分析用户需求后主动添加待办事项。
 * 用户和 AI 共享同一份列表，面板在右下角。
 */

import { add, MAX_TEXT_LENGTH } from "../lib/store.js";

export const name = "todo-add";
export const description =
  "Add a TODO item to the shared task list (visible in the bottom-right panel). " +
  "The AI should proactively add tasks when it identifies action items, deadlines, " +
  "or things the user said they plan to do later. " +
  "User and AI share the same list — both can add, edit, complete, and delete. " +
  `Text must be concise (max ${MAX_TEXT_LENGTH} characters).`;

export const promptGuidelines =
  "When to use todo-add:\n" +
  "- The user explicitly asks to remember or track a task\n" +
  "- The user mentions something they plan to do later (e.g. 'I need to fix that bug')\n" +
  "- You identify a follow-up action during conversation\n" +
  "- After completing a complex task, check if there are related tasks to add\n" +
  "\n" +
  "Do NOT add:\n" +
  "- Trivial one-line actions that don't need tracking\n" +
  "- Tasks that are already in the list (use todo-list to check first)\n" +
  "- Meta-tasks about the TODO list itself";

export const parameters = {
  type: "object",
  properties: {
    text: {
      type: "string",
      description: `TODO content — concise and actionable. Max ${MAX_TEXT_LENGTH} characters.`
    }
  },
  required: ["text"]
};

export async function execute(input, ctx) {
  try {
    const todo = add(ctx.dataDir, input.text);
    return {
      content: [{ type: "text", text: `Added TODO: "${todo.text}"` }]
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Failed to add TODO: ${err.message}` }]
    };
  }
}
