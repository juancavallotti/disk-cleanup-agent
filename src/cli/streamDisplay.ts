/**
 * Two-line rolling display for agent stream: line 1 = last step/tool, line 2 = current content.
 * Handles SIGINT to abort and restore terminal.
 */

import type { BaseMessage } from "@langchain/core/messages";

const CLEAR_LINE = "\r\x1b[K";
const MOVE_UP = "\x1b[1A";

/** Clear the two-line stream area and move cursor to a fresh line. Call before showing a user prompt. */
export function clearStreamArea(): void {
  process.stdout.write(CLEAR_LINE);
  process.stdout.write(MOVE_UP + CLEAR_LINE);
  process.stdout.write("\n");
}

/** Print a blank line before resuming the two-line stream display (call after user answers). */
export function prepareForStreamResume(): void {
  process.stdout.write("\n");
}

function getLastToolFromMessages(messages: BaseMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const type = (m as { _getType?: () => string })._getType?.() ?? (m as { type?: string }).type;
    if (type === "ai") {
      const toolCalls = (m as { tool_calls?: Array<{ name?: string }> }).tool_calls;
      if (toolCalls?.length) {
        return toolCalls.map((t) => t.name ?? "?").join(", ");
      }
      return null;
    }
  }
  return null;
}

function getLastContent(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const content = (m as { content?: unknown }).content;
    if (typeof content === "string" && content.trim()) {
      const max = 80;
      return content.length <= max ? content : content.slice(0, max) + "...";
    }
  }
  return "";
}

export interface StreamDisplayOptions {
  onAbort?: () => void;
}

/**
 * Consume the graph stream and update two lines: step/tool, then content.
 * On SIGINT, restores terminal and calls onAbort.
 */
export async function consumeStreamWithTwoLines(
  stream: AsyncIterable<{ messages?: BaseMessage[] }>,
  options: StreamDisplayOptions = {}
): Promise<{ messages: BaseMessage[] }> {
  const { onAbort } = options;
  let lastState: { messages: BaseMessage[] } = { messages: [] };
  let line1 = "";
  let line2 = "";
  let interrupted = false;

  const restore = (): void => {
    clearStreamArea();
  };

  const update = (): void => {
    const tool = getLastToolFromMessages(lastState.messages);
    const content = getLastContent(lastState.messages);
    const newLine1 = tool ? `Tool: ${tool}` : "Thinking...";
    const newLine2 = content || " ";
    if (newLine1 !== line1 || newLine2 !== line2) {
      line1 = newLine1;
      line2 = newLine2;
      process.stdout.write(CLEAR_LINE + line1 + "\n" + CLEAR_LINE + line2);
      process.stdout.write(MOVE_UP + MOVE_UP);
    }
  };

  const handler = (): void => {
    interrupted = true;
    restore();
    onAbort?.();
  };

  process.on("SIGINT", handler);

  try {
    for await (const chunk of stream) {
      if (interrupted) break;
      if (chunk?.messages) {
        lastState = { messages: chunk.messages };
        update();
      }
    }
  } finally {
    process.off("SIGINT", handler);
    restore();
  }

  return lastState;
}
