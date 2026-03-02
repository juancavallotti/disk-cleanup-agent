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
const THINKING_IDLE_MS = 10_000;
const THINKING_DOT_INTERVAL_MS = 400;
const THINKING_DOTS = [".", "..", "..."] as const;

/** Shared state between stream task and coordinator: latest chunk, optional tool progress, and stream completion. */
export interface StreamSharedState {
  lastChunk: { messages: BaseMessage[] } | null;
  /** When set by a running tool, the coordinator shows this as line 2 (thinking stream). Cleared when a new chunk arrives. */
  toolProgress: string | null;
  done: boolean;
  aborted?: boolean;
  /** Timestamp when lastChunk was last updated (for idle animation after 10s without tokens). */
  lastChunkTime?: number;
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
}

/**
 * Consume the graph stream in the background; update sharedState.lastChunk and set done when finished.
 * Used with runCoordinatorLoop so the coordinator can show thinking vs drain the queue.
 */
export async function runStreamTask(
  stream: AsyncIterable<{ messages?: BaseMessage[] }>,
  sharedState: StreamSharedState,
  options: RunStreamTaskOptions = {}
): Promise<void> {
  const { onAbort } = options;
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
    for await (const chunk of stream) {
      if (sharedState.aborted) break;
      if (chunk?.messages) {
        sharedState.lastChunk = { messages: chunk.messages };
        sharedState.lastChunkTime = Date.now();
        sharedState.toolProgress = null;
      }
    }
  } finally {
    process.off("SIGINT", handler);
    sharedState.done = true;
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
  let dotFrame = 0;
  let lastDotStep = 0;
  let idleAnimationShown = false;
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
      const inThinkingMode =
        !sharedState.done && tool === null;
      const lastChunkTime = sharedState.lastChunkTime ?? 0;
      const noTokensFor10s = Date.now() - lastChunkTime > THINKING_IDLE_MS;
      const showIdleAnimation = inThinkingMode && noTokensFor10s;

      if (showIdleAnimation) {
        const now = Date.now();
        if (lastDotStep === 0) {
          lastDotStep = now;
        } else if (now - lastDotStep >= THINKING_DOT_INTERVAL_MS) {
          lastDotStep = now;
          dotFrame = (dotFrame + 1) % THINKING_DOTS.length;
        }
        const newLine1 = "Thinking";
        const newLine2 = THINKING_DOTS[dotFrame];
        if (!idleAnimationShown) {
          clearStreamArea();
          process.stdout.write(newLine1 + "\n" + newLine2);
          process.stdout.write(MOVE_UP + MOVE_UP);
          idleAnimationShown = true;
          line1 = newLine1;
          line2 = newLine2;
        } else if (newLine1 !== line1 || newLine2 !== line2) {
          line1 = newLine1;
          line2 = newLine2;
          process.stdout.write(CLEAR_LINE + line1 + "\n" + CLEAR_LINE + line2);
          process.stdout.write(MOVE_UP + MOVE_UP);
        }
      } else {
        idleAnimationShown = false;
        if (sharedState.lastChunk || sharedState.toolProgress !== null) {
        const content = sharedState.toolProgress ?? getLastContent(messages);
        const maxContent = 80;
        const newLine2 = (content.length <= maxContent ? content : content.slice(0, maxContent) + "...") || " ";
        const newLine1 = tool ? `Tool: ${tool}` : "Thinking...";
        if (newLine1 !== line1 || newLine2 !== line2) {
          line1 = newLine1;
          line2 = newLine2;
          process.stdout.write(CLEAR_LINE + line1 + "\n" + CLEAR_LINE + line2);
          process.stdout.write(MOVE_UP + MOVE_UP);
        }
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
