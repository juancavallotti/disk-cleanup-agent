import { describe, it, expect } from "vitest";
import { createUserInputQueue } from "./userInputQueue.js";

describe("UserInputQueue", () => {
  it("hasPending returns false when empty", () => {
    const queue = createUserInputQueue();
    expect(queue.hasPending()).toBe(false);
  });

  it("requestInput enqueues and hasPending returns true", () => {
    const queue = createUserInputQueue();
    const p = queue.requestInput({ message: "Q1?" });
    expect(queue.hasPending()).toBe(true);
    expect(p).toBeInstanceOf(Promise);
  });

  it("shiftNext returns enqueued request and resolves with answer", async () => {
    const queue = createUserInputQueue();
    const answerPromise = queue.requestInput({ message: "Say yes?" });
    expect(queue.hasPending()).toBe(true);

    const item = queue.shiftNext();
    expect(item).toBeDefined();
    expect(item!.message).toBe("Say yes?");
    expect(queue.hasPending()).toBe(false);

    item!.resolve("yes");
    await expect(answerPromise).resolves.toBe("yes");
  });

  it("two requests drained in order get correct answers", async () => {
    const queue = createUserInputQueue();
    const p1 = queue.requestInput({ message: "First?" });
    const p2 = queue.requestInput({ message: "Second?" });

    const item1 = queue.shiftNext();
    expect(item1!.message).toBe("First?");
    item1!.resolve("one");

    const item2 = queue.shiftNext();
    expect(item2!.message).toBe("Second?");
    item2!.resolve("two");

    await expect(p1).resolves.toBe("one");
    await expect(p2).resolves.toBe("two");
  });

  it("shiftNext returns undefined when empty", () => {
    const queue = createUserInputQueue();
    expect(queue.shiftNext()).toBeUndefined();
    queue.requestInput({ message: "Q" });
    queue.shiftNext();
    expect(queue.shiftNext()).toBeUndefined();
  });

  it("reject propagates to requestInput promise", async () => {
    const queue = createUserInputQueue();
    const p = queue.requestInput({ message: "Q?" });
    const item = queue.shiftNext();
    const err = new Error("Aborted");
    item!.reject(err);
    await expect(p).rejects.toThrow("Aborted");
  });
});
