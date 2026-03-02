import { describe, it, expect } from "vitest";
import {
  getStreamLineFromQueue,
  STREAM_DISPLAY_MAX_CHARS,
  runStreamTask,
  type StreamSharedState,
} from "./streamDisplay.js";

describe("getStreamLineFromQueue", () => {
  it("returns full string when under max length", () => {
    const queue = ["hello", " world"];
    expect(getStreamLineFromQueue(queue)).toBe("hello world");
  });

  it("returns last STREAM_DISPLAY_MAX_CHARS when over max length", () => {
    const long = "a".repeat(500);
    const queue = [long];
    const result = getStreamLineFromQueue(queue);
    expect(result).toHaveLength(STREAM_DISPLAY_MAX_CHARS);
    expect(result).toBe("a".repeat(STREAM_DISPLAY_MAX_CHARS));
    expect(result).toBe(long.slice(-STREAM_DISPLAY_MAX_CHARS));
  });

  it("strips newlines from joined queue content", () => {
    const queue = ["hello\n", "\r\n", " world"];
    expect(getStreamLineFromQueue(queue)).toBe("hello   world");
  });

  it("returns empty string for empty queue", () => {
    expect(getStreamLineFromQueue([])).toBe("");
  });

  it("trims whitespace", () => {
    const queue = ["  foo  bar  "];
    expect(getStreamLineFromQueue(queue)).toBe("foo  bar");
  });
});

describe("runStreamTask queue behavior", () => {
  it("enqueues token chunks on messages mode and clears queue on values", async () => {
    const sharedState: StreamSharedState = {
      lastChunk: null,
      toolProgress: null,
      done: false,
      streamedTokenQueue: [],
    };
    const stream = (async function* () {
      yield ["messages", [{ content: "hello" }, {}]];
      yield ["messages", [{ content: " " }, {}]];
      yield ["messages", [{ content: "world" }, {}]];
      yield [
        "values",
        {
          messages: [],
        },
      ];
    })();
    await runStreamTask(stream, sharedState);
    expect(sharedState.streamedTokenQueue).toHaveLength(0);
    expect(sharedState.lastChunk).not.toBeNull();
  });

  it("pushes normalized chunks to streamedTokenQueue", async () => {
    const sharedState: StreamSharedState = {
      lastChunk: null,
      toolProgress: null,
      done: false,
      streamedTokenQueue: [],
    };
    const stream = (async function* () {
      yield ["messages", [{ content: "a" }, {}]];
      yield ["messages", [{ content: "b\n" }, {}]];
    })();
    const run = runStreamTask(stream, sharedState);
    await new Promise((r) => setTimeout(r, 0));
    expect(sharedState.streamedTokenQueue).toEqual(["a", "b "]);
    await run;
  });

  it("clears queue on each values chunk", async () => {
    const sharedState: StreamSharedState = {
      lastChunk: null,
      toolProgress: null,
      done: false,
      streamedTokenQueue: [],
    };
    const stream = (async function* () {
      yield ["messages", [{ content: "first" }, {}]];
      yield ["values", { messages: [] }];
      yield ["messages", [{ content: "second" }, {}]];
      yield ["values", { messages: [] }];
    })();
    await runStreamTask(stream, sharedState);
    expect(sharedState.streamedTokenQueue).toHaveLength(0);
  });
});
