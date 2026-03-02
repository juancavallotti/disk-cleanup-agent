/**
 * User input queue: serialized prompts for the CLI coordinator.
 * Callers (e.g. allowlist middleware) enqueue via requestInput and await the Promise.
 * The coordinator drains the queue with shiftNext(), prompts the user, then resolve().
 */

export interface RequestInputOptions {
  message: string;
  validate?: (value: string) => true | string;
}

export interface PendingRequest {
  message: string;
  validate?: (value: string) => true | string;
  resolve(value: string): void;
  reject(reason: unknown): void;
}

export interface UserInputQueue {
  /** Enqueue a request; returns a Promise resolved by the coordinator with the user's answer. */
  requestInput(options: RequestInputOptions): Promise<string>;
  /** Whether there is at least one pending request. */
  hasPending(): boolean;
  /** Remove and return the next pending request for the coordinator to fulfill. */
  shiftNext(): PendingRequest | undefined;
}

export function createUserInputQueue(): UserInputQueue {
  const pending: PendingRequest[] = [];

  return {
    requestInput(options: RequestInputOptions): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        pending.push({
          message: options.message,
          validate: options.validate,
          resolve,
          reject,
        });
      });
    },

    hasPending(): boolean {
      return pending.length > 0;
    },

    shiftNext(): PendingRequest | undefined {
      return pending.shift();
    },
  };
}
