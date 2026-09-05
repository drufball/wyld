import type { Demo } from '@wyld/shared';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildDemo, listDemos, postFeedback } from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { relativeTime } from '../words.js';

export type WyldGameApi = {
  screenshot?: () => string | Promise<string>;
  getState?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
};

function DemoGrid() {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [rebuilding, setRebuilding] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { subscribe } = useLiveEvents();
  const load = useCallback(
    () =>
      void listDemos()
        .then(setDemos)
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    load();
    const visible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', visible);
    const stops = [subscribe('planner.quest_updated', load), subscribe('human.feedback', load)];
    return () => {
      document.removeEventListener('visibilitychange', visible);
      stops.forEach((stop) => stop());
    };
  }, [load, subscribe]);
  useEffect(() => {
    if (!demos.some(({ status }) => status === 'building')) return;
    const timer = window.setInterval(load, 5_000);
    return () => window.clearInterval(timer);
  }, [demos, load]);

  const rebuild = (demo: Demo) => {
    setRebuilding(demo.id);
    setFailed(null);
    void buildDemo(demo.id)
      .then((updated) =>
        setDemos((items) => items.map((item) => (item.id === updated.id ? updated : item))),
      )
      .catch(() => setFailed(demo.id))
      .finally(() => setRebuilding(null));
  };

  return (
    <div className="demo-screen">
      <h1>Demo Discs</h1>
      {demos.length === 0 && <p>No discs yet.</p>}
      <div className="demo-grid">
        {demos.map((demo) => (
          <article className="demo-card" key={demo.id}>
            <h2>{demo.title}</h2>
            {demo.status === 'ready' && (
              <>
                <p>Ready · built {relativeTime(demo.builtAt!, new Date())}</p>
                <Link className="demo-play" to={`/demos/${encodeURIComponent(demo.id)}`}>
                  Play
                </Link>
              </>
            )}
            {demo.status === 'building' && <p>Building this now…</p>}
            {demo.status === 'failed' && (
              <>
                <p>This one didn't build.</p>
                <button
                  type="button"
                  disabled={rebuilding === demo.id}
                  onClick={() => rebuild(demo)}
                >
                  Rebuild
                </button>
                {failed === demo.id && (
                  <p>
                    That didn't go through.{' '}
                    <button type="button" onClick={() => rebuild(demo)}>
                      Retry
                    </button>
                  </p>
                )}
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function DemoPlayer({ id }: { id: string }) {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [thanks, setThanks] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    void listDemos()
      .then((items) => setDemo(items.find((item) => item.id === id) ?? null))
      .catch(() => undefined);
  }, [id]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const submission = text.trim();
    if (!submission) return;
    setSending(true);
    setFailed(false);
    const api = (iframe.current?.contentWindow as (Window & { __wyld?: WyldGameApi }) | null)
      ?.__wyld;
    let screenshot: string | undefined;
    let state: Record<string, unknown> | undefined;
    try {
      screenshot = await api?.screenshot?.();
    } catch {
      /* Optional game hook. */
    }
    try {
      state = await api?.getState?.();
    } catch {
      /* Optional game hook. */
    }
    void postFeedback({
      demoId: id,
      text: submission,
      ...(screenshot ? { screenshot } : {}),
      ...(state ? { state } : {}),
    })
      .then(() => {
        setOpen(false);
        setText('');
        setThanks(true);
      })
      .catch(() => setFailed(true))
      .finally(() => setSending(false));
  };

  return (
    <div className="demo-player">
      <Link className="demo-back" to="/demos">
        Back to discs
      </Link>
      <iframe
        ref={iframe}
        src={`/play/${encodeURIComponent(id)}/`}
        title={demo?.title ?? 'Demo'}
        scrolling="no"
      />
      {thanks && (
        <p className="demo-thanks" role="status">
          Got it — thanks.
        </p>
      )}
      <button
        className="demo-feedback-button"
        type="button"
        onClick={() => {
          setOpen(true);
          setThanks(false);
        }}
      >
        Feedback
      </button>
      {open && (
        <form className="demo-feedback-panel" onSubmit={(event) => void send(event)}>
          <label htmlFor="demo-feedback">What did you think?</label>
          <textarea
            id="demo-feedback"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {failed && (
            <p>
              That didn't go through.{' '}
              <button type="button" onClick={() => void send()}>
                Retry
              </button>
            </p>
          )}
          <div>
            <button type="submit" disabled={sending}>
              Send
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function Demos() {
  const { id } = useParams();
  return id ? <DemoPlayer id={id} /> : <DemoGrid />;
}
