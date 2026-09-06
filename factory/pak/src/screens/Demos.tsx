import type { Demo } from '@wyld/shared';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { buildDemo, listDemos, patchQuestStatus, postFeedback } from '../api/client.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Textarea } from '../components/ui/textarea.js';
import { cn } from '../lib/utils.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { relativeTime } from '../words.js';

export type WyldGameApi = {
  screenshot?: () => string | Promise<string>;
  getState?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
};

type FeedbackExtras = () => Promise<{
  screenshot?: string;
  state?: Record<string, unknown>;
}>;

function FeedbackForm({
  demoId,
  getExtras,
  formClassName,
}: {
  demoId: string;
  getExtras?: FeedbackExtras;
  formClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [thanks, setThanks] = useState(false);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const submission = text.trim();
    if (!submission) return;
    setSending(true);
    setFailed(false);
    const extras = (await getExtras?.()) ?? {};
    void postFeedback({ demoId, text: submission, ...extras })
      .then(() => {
        setOpen(false);
        setText('');
        setThanks(true);
      })
      .catch(() => setFailed(true))
      .finally(() => setSending(false));
  };

  return (
    <div className="grid gap-2">
      {thanks && (
        <Card asChild variant="flat" className="p-2">
          <p role="status">Got it — thanks.</p>
        </Card>
      )}
      <Button
        variant="retro"
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
          className={cn('grid w-full min-w-0 gap-2 p-3', formClassName)}
        >
          <form onSubmit={(event) => void send(event)}>
            <label htmlFor={`demo-feedback-${demoId}`}>What did you think?</label>
            <Textarea
              className="min-h-24 resize-y"
              id={`demo-feedback-${demoId}`}
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
            <div className="flex flex-wrap gap-2">
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

function MarkDone({
  onMarkDone,
  marking,
  failed,
}: {
  onMarkDone: () => void;
  marking: boolean;
  failed: boolean;
}) {
  return (
    <>
      <Button variant="retro" type="button" disabled={marking} onClick={onMarkDone}>
        Mark done
      </Button>
      {failed && (
        <p className="m-0 basis-full text-muted-foreground">
          That didn't go through.{' '}
          <Button variant="ghost" type="button" onClick={onMarkDone}>
            Retry
          </Button>
        </p>
      )}
    </>
  );
}

function LiveDemoContent({
  demo,
  onMarkDone,
  markingDone = false,
  markDoneFailed = false,
}: {
  demo: Demo;
  onMarkDone?: () => void;
  markingDone?: boolean;
  markDoneFailed?: boolean;
}) {
  return (
    <>
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h2 className="m-0 wrap-anywhere text-xl leading-snug">{demo.title}</h2>
        <Badge variant="tone" data-tone={demo.kind === 'pak' ? 'accent' : 'ok'}>
          {demo.kind === 'pak' ? 'BRANCH' : 'TRY IT'}
        </Badge>
      </header>
      {demo.summary && <p className="m-0 wrap-anywhere">{demo.summary}</p>}
      {demo.steps.length > 0 && (
        <ol className="m-0 grid list-decimal gap-2 pl-6">
          {demo.steps.map((step, index) => (
            <li className="wrap-anywhere" key={index}>
              {step}
            </li>
          ))}
        </ol>
      )}
      {demo.seeded.length > 0 && (
        <section className="grid min-w-0 gap-2">
          <h3 className="m-0 text-sm">What's already there</h3>
          <ul className="m-0 grid list-disc gap-1 pl-6">
            {demo.seeded.map((item, index) => (
              <li className="wrap-anywhere" key={index}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="retro">
          {demo.kind === 'pak' ? (
            <a href={demo.url}>Try it</a>
          ) : (
            <Link to={demo.deepLink ?? '/'}>Try it</Link>
          )}
        </Button>
        {demo.questId !== null && onMarkDone && (
          <MarkDone onMarkDone={onMarkDone} marking={markingDone} failed={markDoneFailed} />
        )}
      </div>
      <FeedbackForm demoId={demo.id} />
    </>
  );
}

function DemoGrid() {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [rebuilding, setRebuilding] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [markingDone, setMarkingDone] = useState<string | null>(null);
  const [markDoneFailed, setMarkDoneFailed] = useState<string | null>(null);
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
  const markDone = (demo: Demo) => {
    if (demo.questId === null) return;
    setMarkingDone(demo.id);
    setMarkDoneFailed(null);
    void patchQuestStatus(demo.questId, 'done')
      .then(() => setDemos((items) => items.filter((item) => item.id !== demo.id)))
      .catch(() => setMarkDoneFailed(demo.id))
      .finally(() => setMarkingDone(null));
  };
  return (
    <div className="mx-auto max-w-[1100px]">
      <h1>Demos</h1>
      {demos.length === 0 && <p>Nothing to try yet.</p>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5">
        {demos.map((demo) => {
          const tone =
            demo.status === 'ready' ? 'ok' : demo.status === 'building' ? 'accent' : 'bad';
          return (
            <Card asChild variant="bevel" data-tone={tone} key={demo.id}>
              <article className="demo-card grid min-w-0 content-start gap-3 p-5">
                {demo.kind === 'live' || (demo.kind === 'pak' && demo.status === 'ready') ? (
                  <LiveDemoContent
                    demo={demo}
                    onMarkDone={() => markDone(demo)}
                    markingDone={markingDone === demo.id}
                    markDoneFailed={markDoneFailed === demo.id}
                  />
                ) : (
                  <>
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
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="retro">
                            <Link to={`/demos/${encodeURIComponent(demo.id)}`}>Play</Link>
                          </Button>
                          {demo.questId !== null && (
                            <MarkDone
                              onMarkDone={() => markDone(demo)}
                              marking={markingDone === demo.id}
                              failed={markDoneFailed === demo.id}
                            />
                          )}
                        </div>
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
  const [demo, setDemo] = useState<Demo | null | undefined>(undefined);
  const [markingDone, setMarkingDone] = useState(false);
  const [markDoneFailed, setMarkDoneFailed] = useState(false);
  const navigate = useNavigate();
  const iframe = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    void listDemos()
      .then((items) => setDemo(items.find((item) => item.id === id) ?? null))
      .catch(() => setDemo(null));
  }, [id]);
  const markDone = () => {
    if (demo?.questId == null) return;
    setMarkingDone(true);
    setMarkDoneFailed(false);
    void patchQuestStatus(demo.questId, 'done')
      .then(() => navigate('/demos'))
      .catch(() => setMarkDoneFailed(true))
      .finally(() => setMarkingDone(false));
  };
  if (demo === undefined) return null;
  if (demo === null)
    return (
      <div className="grid gap-4">
        <p>That demo isn't here.</p>
        <Button asChild variant="retro">
          <Link to="/demos">Back to demos</Link>
        </Button>
      </div>
    );
  if (demo.kind === 'live' || demo.kind === 'pak')
    return (
      <div className="grid gap-4">
        <Button asChild variant="retro">
          <Link to="/demos">Back to demos</Link>
        </Button>
        <Card asChild variant="bevel">
          <article className="demo-card grid min-w-0 gap-3 p-5">
            <LiveDemoContent
              demo={demo}
              onMarkDone={markDone}
              markingDone={markingDone}
              markDoneFailed={markDoneFailed}
            />
          </article>
        </Card>
      </div>
    );
  const getExtras: FeedbackExtras = async () => {
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
    return { ...(screenshot ? { screenshot } : {}), ...(state ? { state } : {}) };
  };
  return (
    <div className="fixed inset-x-0 top-0 bottom-[72px] bg-card">
      <Button asChild variant="retro" className="absolute left-3 top-3 z-2">
        <Link to="/demos">Back to demos</Link>
      </Button>
      <iframe
        className="size-full border-0"
        ref={iframe}
        src={`/play/${encodeURIComponent(id)}/`}
        title={demo.title}
        scrolling="no"
      />
      <div className="absolute bottom-3 right-3 z-2 w-fit">
        <FeedbackForm
          demoId={id}
          getExtras={getExtras}
          formClassName="w-[min(340px,calc(100vw-24px))]"
        />
      </div>
    </div>
  );
}

export function Demos() {
  const { id } = useParams();
  return id ? <DemoPlayer id={id} /> : <DemoGrid />;
}
