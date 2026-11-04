export class TurnstileTokenError extends Error {
  constructor(message) {
    super(message);
    this.name = "TurnstileTokenError";
  }
}

function abortError(signal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted.", "AbortError");
}

export function createTurnstileTokenGate() {
  let token = "";
  let busy = false;
  let failure = null;
  let waiter = null;

  function rejectWaiter(error) {
    if (!waiter) return;
    const pending = waiter;
    waiter = null;
    pending.cleanup();
    pending.reject(error);
  }

  return {
    get busy() {
      return busy;
    },
    get failed() {
      return failure !== null;
    },
    provide(value) {
      if (typeof value !== "string" || !value || failure) return;
      if (waiter) {
        const pending = waiter;
        waiter = null;
        pending.cleanup();
        pending.resolve(value);
      } else if (!busy) {
        token = value;
      }
    },
    invalidate() {
      token = "";
    },
    fail(message) {
      token = "";
      failure = new TurnstileTokenError(message);
      rejectWaiter(failure);
    },
    recover() {
      token = "";
      failure = null;
    },
    async acquire(signal) {
      if (busy) throw new TurnstileTokenError("A security check is already in progress.");
      if (failure) throw failure;
      busy = true;

      try {
        if (signal?.aborted) throw abortError(signal);
        if (token) {
          const next = token;
          token = "";
          return next;
        }

        return await new Promise((resolve, reject) => {
          const onAbort = () => {
            rejectWaiter(abortError(signal));
          };
          const cleanup = () => signal?.removeEventListener("abort", onAbort);
          waiter = {
            resolve: (value) => resolve(value),
            reject,
            cleanup,
          };
          signal?.addEventListener("abort", onAbort, { once: true });
          if (signal?.aborted) onAbort();
        });
      } catch (error) {
        busy = false;
        throw error;
      }
    },
    async execute(operation, { signal, reset } = {}) {
      const value = await this.acquire(signal);
      try {
        return await operation(value);
      } finally {
        this.finish();
        reset?.();
      }
    },
    finish() {
      token = "";
      failure = null;
      busy = false;
    },
  };
}
