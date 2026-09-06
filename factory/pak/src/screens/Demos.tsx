import type { Demo } from '@wyld/shared';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildDemo, listDemos, postFeedback } from '../api/client.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Textarea } from '../components/ui/textarea.js';
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
    <div className="mx-auto max-w-[1100px]">
      <h1>Demo Discs</h1>
      {demos.length === 0 && <p>No discs yet.</p>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5">
        {demos.map((demo) => {
          const tone =
            demo.status === 'ready' ? 'ok' : demo.status === 'building' ? 'accent' : 'bad';
          return (
            <Card asChild variant="bevel" data-tone={tone} key={demo.id}>
              <article className="demo-card grid content-start gap-3 p-5">
                <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <h2 className="m-0 wrap-anywhere text-xl leading-snug">{demo.title}</h2>
                  <Badge variant="tone" data-tone={tone}>
                    {demo.status}
                  </Badge>
                </header>
                {demo.status === 'ready' && (
                  <>
                    <p className="m-0 text-muted-foreground">
                      Ready · built {relativeTime(demo.builtAt!, new Date())}
                    </p>
                    <Button asChild variant="retro">
                      <Link to={`/demos/${encodeURIComponent(demo.id)}`}>Play</Link>
                    </Button>
                  </>
                )}
                {demo.status === 'building' && (
                  <p className="m-0 text-muted-foreground">Building this now…</p>
                )}
                {demo.status === 'failed' && (
                  <>
                    <p className="m-0">This one didn't build.</p>
                    <Button
                      variant="retro"
                      type="button"
                      disabled={rebuilding === demo.id}
                      onClick={() => rebuild(demo)}
                    >
                      Rebuild
                    </Button>
                    {failed === demo.id && (
                      <p className="m-0 text-muted-foreground">
                        That didn't go through.{' '}
                        <Button variant="ghost" type="button" onClick={() => rebuild(demo)}>
                          Retry
                        </Button>
                      </p>
                    )}
                  </>
                )}
              </article>
            </Card>
          );
        })}
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
    <div className="fixed inset-0 z-[60] bg-card">
      <Button asChild variant="retro" className="absolute left-3 top-3 z-2">
        <Link to="/demos">Back to discs</Link>
      </Button>
      <iframe
        className="size-full border-0"
        ref={iframe}
        src={`/play/${encodeURIComponent(id)}/`}
        title={demo?.title ?? 'Demo'}
        scrolling="no"
      />
      {thanks && (
        <Card asChild variant="flat" className="absolute bottom-20 right-3 z-2 p-2">
          <p role="status">Got it — thanks.</p>
        </Card>
      )}
      <Button
        variant="retro"
        className="absolute bottom-3 right-3 z-2"
        type="button"
        onClick={() => {
          setOpen(true);
          setThanks(false);
        }}
      >
        Feedback
      </Button>
      {open && (
        <Card
          asChild
          variant="bevel"
          className="absolute bottom-3 right-3 z-2 grid w-[min(340px,calc(100%-24px))] gap-2 p-3"
        >
          <form onSubmit={(event) => void send(event)}>
            <label htmlFor="demo-feedback">What did you think?</label>
            <Textarea
              className="min-h-24 resize-y"
              id="demo-feedback"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            {failed && (
              <p className="m-0 text-muted-foreground">
                That didn't go through.{' '}
                <Button variant="ghost" type="button" onClick={() => void send()}>
                  Retry
                </Button>
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="retro" type="submit" disabled={sending}>
                Send
              </Button>
              <Button variant="retro" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export function Demos() {
  const { id } = useParams();
  return id ? <DemoPlayer id={id} /> : <DemoGrid />;
}
