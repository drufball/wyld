type EventListener<Payload> = (payload: Payload) => void;

const createEventBus = <E extends Record<string, unknown>>() => {
  const listeners = new Map<keyof E, Set<EventListener<E[keyof E]>>>();

  const off = <K extends keyof E>(kind: K, listener: EventListener<E[K]>): void => {
    listeners.get(kind)?.delete(listener as EventListener<E[keyof E]>);
  };
  const on = <K extends keyof E>(kind: K, listener: EventListener<E[K]>): (() => void) => {
    let subscribers = listeners.get(kind);
    if (!subscribers) {
      subscribers = new Set();
      listeners.set(kind, subscribers);
    }
    subscribers.add(listener as EventListener<E[keyof E]>);
    return () => off(kind, listener);
  };
  const emit = <K extends keyof E>(kind: K, payload: E[K]): void => {
    for (const listener of listeners.get(kind) ?? []) listener(payload);
  };
  return { on, off, emit };
};

export { createEventBus };
