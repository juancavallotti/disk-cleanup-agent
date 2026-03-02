/**
 * Single-line stream display: one line, max 400 chars, updated in place with \r.
 * Handles SIGINT to abort and restore terminal.
 * Coordinator loop alternates between showing the line and draining the user input queue.
 */

import input from "@inquirer/input";
import type { BaseMessage } from "@langchain/core/messages";
import type { UserInputQueue, PendingRequest } from "./userInputQueue.js";

const CLEAR_LINE = "\r\x1b[K";

const COORDINATOR_POLL_MS = 50;

/** Max characters shown for the in-place streamed token line. */
export const STREAM_DISPLAY_MAX_CHARS = 400;

/** Shared state between stream task and coordinator: latest chunk, optional tool progress, and stream completion. */
export interface StreamSharedState {
  lastChunk: { messages: BaseMessage[] } | null;
  /** When set by a running tool, the coordinator shows this on the single stream line (max 400 chars). Cleared when a new chunk arrives. */
  toolProgress: string | null;
  done: boolean;
  aborted?: boolean;
  /** Enqueued LLM token chunks for the current turn (cleared on values update). Coordinator reads for display. */
  streamedTokenQueue: string[];
}

/**
 * Build the current stream line from the queue: join chunks, strip newlines, return last STREAM_DISPLAY_MAX_CHARS.
 */
export function getStreamLineFromQueue(queue: string[]): string {
  const raw = queue.join("").replace(/\r\n|\r|\n/g, " ").trim();
  if (raw.length <= STREAM_DISPLAY_MAX_CHARS) return raw;
  return raw.slice(-STREAM_DISPLAY_MAX_CHARS);
}

/** Clear the stream line and move cursor to a fresh line. Call before showing a user prompt. */
export function clearStreamArea(): void {
  process.stdout.write(CLEAR_LINE);
  process.stdout.write("\n");
}

/** Print a blank line before resuming the stream line (call after user answers). */
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
      const noNewlines = content.replace(/\r\n|\r|\n/g, " ").trim();
      if (!noNewlines) continue;
      const max = 80;
      return noNewlines.length <= max ? noNewlines : noNewlines.slice(0, max) + "...";
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
 * When "messages" mode is used, LLM tokens are enqueued to sharedState.streamedTokenQueue; queue is cleared on each "values" chunk.
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
            sharedState.streamedTokenQueue.length = 0;
          }
        } else if (mode === "messages") {
          const [messageChunk] = data as [BaseMessage, Record<string, unknown>];
          const content = (messageChunk as { content?: string }).content;
          if (typeof content === "string" && content) {
            const noNewlines = content.replace(/\r\n|\r|\n/g, " ");
            sharedState.streamedTokenQueue.push(noNewlines);
          }
        }
        continue;
      }
      // Single-mode "values": chunk is state directly
      const state = item as { messages?: BaseMessage[] };
      if (state?.messages) {
        sharedState.lastChunk = { messages: state.messages };
        sharedState.toolProgress = null;
        sharedState.streamedTokenQueue.length = 0;
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
 * when the queue is empty, update the single stream line (50 chars, \r in place) from sharedState.
 * Exits when sharedState.done is true and the queue is empty.
 */
export async function runCoordinatorLoop(
  sharedState: StreamSharedState,
  queue: UserInputQueue,
  options: RunCoordinatorLoopOptions = {}
): Promise<void> {
  const { onAbort } = options;
  let lastLine = "";
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
      const hasStreamedContent = sharedState.streamedTokenQueue.length > 0;
      const streamLine = hasStreamedContent ? getStreamLineFromQueue(sharedState.streamedTokenQueue) : "";

      let raw: string;
      if (sharedState.toolProgress !== null) {
        raw = sharedState.toolProgress.replace(/\r\n|\r|\n/g, " ").trim();
      } else if (streamLine) {
        raw = streamLine;
      } else if (!sharedState.done) {
        const tool = getLastToolFromMessages(messages);
        raw = tool ? `Tool: ${tool}` : "Thinking...";
      } else {
        const content = getLastContent(messages);
        raw = content ? content.replace(/\r\n|\r|\n/g, " ").trim() : " ";
      }

      const line =
        raw.length <= STREAM_DISPLAY_MAX_CHARS ? raw : "…" + raw.slice(-(STREAM_DISPLAY_MAX_CHARS - 1));

      if (line !== lastLine) {
        lastLine = line;
        process.stdout.write(CLEAR_LINE + line);
      }

      await new Promise((r) => setTimeout(r, COORDINATOR_POLL_MS));
    }
    process.stdout.write(CLEAR_LINE);
  } finally {
    process.off("SIGINT", handler);
    restore();
  }
}

/**
 * Consume the graph stream and update a single line (50 chars, \r in place). On SIGINT, restores terminal and calls onAbort.
 */
export async function consumeStreamWithTwoLines(
  stream: AsyncIterable<{ messages?: BaseMessage[] }>,
  options: StreamDisplayOptions = {}
): Promise<{ messages: BaseMessage[] }> {
  const { onAbort } = options;
  let lastState: { messages: BaseMessage[] } = { messages: [] };
  let lastLine = "";
  let interrupted = false;

  const restore = (): void => {
    clearStreamArea();
  };

  const update = (): void => {
    const tool = getLastToolFromMessages(lastState.messages);
    const content = getLastContent(lastState.messages);
    const raw = tool ? `Tool: ${tool}` : content || "Thinking...";
    const line =
      raw.length <= STREAM_DISPLAY_MAX_CHARS ? raw : "…" + raw.slice(-(STREAM_DISPLAY_MAX_CHARS - 1));
    if (line !== lastLine) {
      lastLine = line;
      process.stdout.write(CLEAR_LINE + line);
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
