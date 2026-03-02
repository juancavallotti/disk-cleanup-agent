/**
 * Two-line rolling display for agent stream: line 1 = last step/tool, line 2 = current content.
 * Handles SIGINT to abort and restore terminal.
 * Coordinator loop alternates between showing thinking stream and draining the user input queue.
 */

import input from "@inquirer/input";
import type { BaseMessage } from "@langchain/core/messages";
import type { UserInputQueue, PendingRequest } from "./userInputQueue.js";

const CLEAR_LINE = "\r\x1b[K";
const MOVE_UP = "\x1b[1A";

const COORDINATOR_POLL_MS = 50;

/** Shared state between stream task and coordinator: latest chunk, optional tool progress, and stream completion. */
export interface StreamSharedState {
  lastChunk: { messages: BaseMessage[] } | null;
  /** When set by a running tool, the coordinator shows this as line 2 (thinking stream). Cleared when a new chunk arrives. */
  toolProgress: string | null;
  done: boolean;
  aborted?: boolean;
  /** Accumulated LLM token stream for the current turn (cleared on values update). Shown as line 2 when set. */
  streamedText?: string;
}

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

export interface RunStreamTaskOptions {
  onAbort?: () => void;
  /** When false, do not set sharedState.done when the stream ends (e.g. so coordinator can still show a follow-up prompt). Default true. */
  setDoneOnComplete?: boolean;
}

/**
 * Consume the graph stream in the background; update sharedState.lastChunk and set done when finished.
 * Supports streamMode "values" (chunk = state) or ["values", "messages"] (chunk = [mode, data]).
 * When "messages" mode is used, LLM tokens are accumulated in sharedState.streamedText.
 */
export async function runStreamTask(
  stream: AsyncIterable<unknown>,
  sharedState: StreamSharedState,
  options: RunStreamTaskOptions = {}
): Promise<void> {
  const { onAbort, setDoneOnComplete = true } = options;
  const restore = (): void => {
    clearStreamArea();
  };

  const handler = (): void => {
    sharedState.aborted = true;
    restore();
    onAbort?.();
  };

  process.on("SIGINT", handler);
  try {
    for await (const item of stream) {
      if (sharedState.aborted) break;
      // Multi-mode: [mode, chunk]
      if (Array.isArray(item) && item.length === 2 && typeof item[0] === "string") {
        const [mode, data] = item;
        if (mode === "values") {
          const state = data as { messages?: BaseMessage[] };
          if (state?.messages) {
            sharedState.lastChunk = { messages: state.messages };
            sharedState.toolProgress = null;
            sharedState.streamedText = "";
          }
        } else if (mode === "messages") {
          const [messageChunk] = data as [BaseMessage, Record<string, unknown>];
          const content = (messageChunk as { content?: string }).content;
          if (typeof content === "string" && content) {
            const noNewlines = content.replace(/\r\n|\r|\n/g, " ");
            sharedState.streamedText = (sharedState.streamedText ?? "") + noNewlines;
          }
        }
        continue;
      }
      // Single-mode "values": chunk is state directly
      const state = item as { messages?: BaseMessage[] };
      if (state?.messages) {
        sharedState.lastChunk = { messages: state.messages };
        sharedState.toolProgress = null;
        sharedState.streamedText = "";
      }
    }
  } finally {
    process.off("SIGINT", handler);
    if (setDoneOnComplete) {
      sharedState.done = true;
    }
    restore();
  }
}

export interface RunCoordinatorLoopOptions {
  onAbort?: () => void;
}

/**
 * Run the coordinator loop: when the queue has items, clear stream area, show prompt, resolve with answer;
 * when the queue is empty, update the two-line thinking display from sharedState.
 * Exits when sharedState.done is true and the queue is empty.
 */
export async function runCoordinatorLoop(
  sharedState: StreamSharedState,
  queue: UserInputQueue,
  options: RunCoordinatorLoopOptions = {}
): Promise<void> {
  const { onAbort } = options;
  let line1 = "";
  let line2 = "";
  let currentRequest: PendingRequest | undefined;

  const restore = (): void => {
    clearStreamArea();
  };

  const handler = (): void => {
    restore();
    if (currentRequest) {
      currentRequest.reject(new Error("Aborted"));
      currentRequest = undefined;
    }
    onAbort?.();
  };

  process.on("SIGINT", handler);
  try {
    while (!sharedState.done || queue.hasPending()) {
      if (sharedState.aborted) break;

      if (queue.hasPending()) {
        restore();
        process.stdout.write("\n\n");
        const item = queue.shiftNext();
        if (!item) continue;
        currentRequest = item;
        try {
          const answer = await input({
            message: item.message,
            validate: item.validate,
          });
          currentRequest = undefined;
          item.resolve(answer);
        } catch (err) {
          currentRequest = undefined;
          item.reject(err);
        }
        prepareForStreamResume();
        continue;
      }

      const messages = sharedState.lastChunk?.messages ?? [];
      const tool = getLastToolFromMessages(messages);
      const inThinkingMode = !sharedState.done && tool === null;

      if (sharedState.lastChunk || sharedState.toolProgress !== null || (sharedState.streamedText ?? "")) {
        let rawContent =
          sharedState.toolProgress ??
          (sharedState.streamedText && sharedState.streamedText.trim()
            ? sharedState.streamedText
            : getLastContent(messages));
        rawContent = rawContent.replace(/\r\n|\r|\n/g, " ");
        const maxContent = 80;
        const newLine2 =
          (rawContent.length <= maxContent ? rawContent : "…" + rawContent.slice(-(maxContent - 1))) || " ";
        const newLine1 = tool ? `Tool: ${tool}` : "Thinking...";
        if (newLine1 !== line1 || newLine2 !== line2) {
          line1 = newLine1;
          line2 = newLine2;
          process.stdout.write(CLEAR_LINE + line1 + "\n" + CLEAR_LINE + line2);
          process.stdout.write(MOVE_UP + MOVE_UP);
        }
      } else if (inThinkingMode) {
        const newLine1 = "Thinking...";
        const newLine2 = " ";
        if (newLine1 !== line1 || newLine2 !== line2) {
          line1 = newLine1;
          line2 = newLine2;
          process.stdout.write(CLEAR_LINE + line1 + "\n" + CLEAR_LINE + line2);
          process.stdout.write(MOVE_UP + MOVE_UP);
        }
      }
      await new Promise((r) => setTimeout(r, COORDINATOR_POLL_MS));
    }
  } finally {
    process.off("SIGINT", handler);
    restore();
  }
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
