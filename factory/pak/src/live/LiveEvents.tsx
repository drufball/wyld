import { Event as EventSchema, type EventKind, type Event as WyldEvent } from '@wyld/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type EventHandler = (event: WyldEvent) => void;
type EventSourceLike = {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  close(): void;
};
export type EventSourceFactory = (url: string) => EventSourceLike;

const defaultEventSourceFactory: EventSourceFactory = (url) => new EventSource(url);

type LiveEventsValue = {
  connected: boolean;
  lastEvent: WyldEvent | null;
  subscribe: (kind: EventKind, handler: EventHandler) => () => void;
};

const LiveEventsContext = createContext<LiveEventsValue | null>(null);

export function LiveEventsProvider({
  children,
  eventSourceFactory = defaultEventSourceFactory,
}: {
  children: ReactNode;
  eventSourceFactory?: EventSourceFactory;
}) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WyldEvent | null>(null);
  const handlers = useRef(new Map<EventKind, Set<EventHandler>>());
  const subscribe = useCallback((kind: EventKind, handler: EventHandler) => {
    const kindHandlers = handlers.current.get(kind) ?? new Set<EventHandler>();
    kindHandlers.add(handler);
    handlers.current.set(kind, kindHandlers);
    return () => {
      kindHandlers.delete(handler);
      if (kindHandlers.size === 0) handlers.current.delete(kind);
    };
  }, []);

  useEffect(() => {
    const source = eventSourceFactory('/api/events/stream');
    const updateConnected = (nextConnected: boolean) => {
      setConnected((currentConnected) =>
        currentConnected === nextConnected ? currentConnected : nextConnected,
      );
    };
    const open = () => updateConnected(true);
    const error = () => updateConnected(false);
    const receive = (message: globalThis.Event) => {
      if (!(message instanceof MessageEvent)) return;
      let payload: unknown;
      try {
        payload = JSON.parse(String(message.data));
      } catch {
        console.error('Dropped invalid live event JSON');
        return;
      }
      const parsed = EventSchema.safeParse(payload);
      if (!parsed.success) {
        console.error('Dropped invalid live event', parsed.error);
        return;
      }
      setLastEvent(parsed.data);
      for (const handler of handlers.current.get(parsed.data.kind) ?? []) handler(parsed.data);
    };
    source.addEventListener('open', open);
    source.addEventListener('error', error);
    source.addEventListener('event', receive as EventListener);
    return () => {
      source.removeEventListener('open', open);
      source.removeEventListener('error', error);
      source.removeEventListener('event', receive as EventListener);
      source.close();
    };
  }, [eventSourceFactory]);

  const value = useMemo(
    () => ({ connected, lastEvent, subscribe }),
    [connected, lastEvent, subscribe],
  );
  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}

export function useLiveEvents() {
  const value = useContext(LiveEventsContext);
  if (value === null) throw new Error('useLiveEvents must be used inside LiveEventsProvider');
  return value;
}
