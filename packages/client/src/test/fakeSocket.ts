import type { QuizSocket } from '../socket.js';

type Handler = (...args: unknown[]) => void;

/**
 * A minimal stand-in for a Socket.IO client used in component tests. It records
 * emitted events, lets tests script ack responses, and can push server events
 * to registered handlers.
 */
export class FakeSocket {
  readonly emitted: { event: string; args: unknown[] }[] = [];
  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly ackResponders = new Map<
    string,
    (args: unknown[]) => unknown
  >();

  on(event: string, handler: Handler): this {
    this.getSet(event).add(handler);
    return this;
  }

  once(event: string, handler: Handler): this {
    const wrapper: Handler = (...args) => {
      this.getSet(event).delete(wrapper);
      handler(...args);
    };
    this.getSet(event).add(wrapper);
    return this;
  }

  off(event: string, handler: Handler): this {
    this.getSet(event).delete(handler);
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    this.emitted.push({ event, args });
    const last = args[args.length - 1];
    const responder = this.ackResponders.get(event);
    if (typeof last === 'function' && responder) {
      (last as (response: unknown) => void)(responder(args.slice(0, -1)));
    }
    return this;
  }

  // --- Test helpers ---------------------------------------------------------

  /** Script the ack response for an event the client emits. */
  respondToAck(event: string, responder: (args: unknown[]) => unknown): void {
    this.ackResponders.set(event, responder);
  }

  /** Simulate the server pushing an event to the client. */
  serverEmit(event: string, ...args: unknown[]): void {
    for (const handler of [...this.getSet(event)]) {
      handler(...args);
    }
  }

  /** All payloads emitted for a given event. */
  emittedArgs(event: string): unknown[][] {
    return this.emitted.filter((e) => e.event === event).map((e) => e.args);
  }

  asSocket(): QuizSocket {
    return this as unknown as QuizSocket;
  }

  private getSet(event: string): Set<Handler> {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    return set;
  }
}
