import type { Chain } from '@wyld/shared';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  buildDemo,
  closeChain,
  listChains,
  listQuests,
  postFeedback,
  reopenChain,
  unsnoozeChain,
} from '../api/client.js';
import { ChainActionsMenu } from '../components/ChainList.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Textarea } from '../components/ui/textarea.js';
import { demoCard, type DemoCard } from '../lib/chain-cards.js';
import { cn } from '../lib/utils.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { relativeTime } from '../words.js';

export type WyldGameApi = {
  screenshot?: () => string | Promise<string>;
  getState?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
};

type FeedbackExtras = () => Promise<{ screenshot?: string; state?: Record<string, unknown> }>;

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

function DemoBody({ chain, demo, reload }: { chain: Chain; demo: DemoCard; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failedAction, setFailedAction] = useState<(() => void) | null>(null);
  const act = (action: () => Promise<unknown>) => {
    setBusy(true);
    setFailedAction(null);
    void action()
      .then(reload)
      .catch(() => setFailedAction(() => () => act(action)))
      .finally(() => setBusy(false));
  };
  const tone = demo.status === 'ready' ? 'ok' : demo.status === 'building' ? 'accent' : 'bad';
  const readyLabel =
    demo.demoKind === 'pak' ? 'BRANCH' : demo.demoKind === 'disc' ? 'PLAY' : 'TRY IT';
  return (
    <>
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h2 className="m-0 wrap-anywhere text-xl leading-snug">{demo.title}</h2>
        <Badge variant="tone" data-tone={tone}>
          {demo.status === 'ready' ? readyLabel : demo.status}
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
      {demo.status === 'building' && (
        <p className="m-0 text-muted-foreground">Building this now…</p>
      )}
      {demo.status === 'failed' && <p className="m-0">This one didn't build.</p>}
      {demo.status === 'ready' && demo.demoKind === 'disc' && demo.builtAt && (
        <p className="m-0 text-muted-foreground">
          Ready · built {relativeTime(demo.builtAt, new Date())}
        </p>
      )}
      <div className="relative flex flex-wrap gap-2">
        {demo.status === 'ready' && (
          <Button asChild variant="retro">
            {demo.demoKind === 'pak' ? (
              <a href={demo.url}>Try it</a>
            ) : demo.demoKind === 'disc' ? (
              <Link to={`/demos/${encodeURIComponent(demo.demoId)}`}>Play</Link>
            ) : (
              <Link to={demo.deepLink ?? '/'}>Try it</Link>
            )}
          </Button>
        )}
        <Button
          variant="retro"
          type="button"
          disabled={busy}
          onClick={() =>
            act(() => closeChain(chain.id, chain.questId === null ? 'settled' : 'done'))
          }
        >
          {chain.questId === null ? 'Hide' : 'Mark done'}
        </Button>
        {demo.status === 'failed' && demo.demoKind !== 'live' && (
          <Button
            variant="retro"
            type="button"
            disabled={busy}
            onClick={() => act(() => buildDemo(demo.demoId))}
          >
            Rebuild
          </Button>
        )}
        <ChainActionsMenu
          chain={chain}
          onChange={() => undefined}
          onSnoozed={() => undefined}
          runAction={(action, success) => act(() => action().then(success))}
        />
        {failedAction && (
          <p className="m-0 basis-full text-muted-foreground">
            That didn't go through.{' '}
            <Button variant="ghost" type="button" onClick={failedAction}>
              Retry
            </Button>
          </p>
        )}
      </div>
      <FeedbackForm demoId={demo.demoId} />
    </>
  );
}

function DemoGrid() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [doneQuests, setDoneQuests] = useState<Set<string>>(new Set());
  const { subscribe } = useLiveEvents();
  const load = useCallback(
    () => {
      void listChains({ kind: 'demo', status: 'all', includeSnoozed: true })
        .then(setChains)
        .catch(() => undefined);
      void listQuests({ status: 'done' })
        .then((quests) => setDoneQuests(new Set(quests.map((quest) => quest.id))))
        .catch(() => setDoneQuests(new Set()));
    },
    [],
  );
  useEffect(() => {
    load();
    const visible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', visible);
    const stops = [
      'planner.chain_updated',
      'human.chain_closed',
      'planner.quest_updated',
      'human.feedback',
    ].map((event) => subscribe(event as Parameters<typeof subscribe>[0], load));
    return () => {
      document.removeEventListener('visibilitychange', visible);
      stops.forEach((stop) => stop());
    };
  }, [load, subscribe]);
  useEffect(() => {
    if (!chains.some((chain) => demoCard(chain)?.status === 'building')) return;
    const timer = window.setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [chains, load]);
  const now = Date.now();
  const grid = chains.filter(
    (chain) =>
      chain.status === 'open' && !(chain.snoozedUntil && Date.parse(chain.snoozedUntil) > now),
  );
  const snoozed = chains.filter(
    (chain) =>
      chain.status === 'open' && chain.snoozedUntil && Date.parse(chain.snoozedUntil) > now,
  );
  const hidden = chains.filter((chain) => chain.status === 'settled');
  const fold = (
    label: string,
    items: Chain[],
    action: (chain: Chain) => Promise<unknown>,
    verb: (chain: Chain) => string,
    wake = false,
  ) =>
    items.length ? (
      <details className="grid gap-2">
        <summary className="flex min-h-11 cursor-pointer items-center py-2 font-display text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {label} ({items.length})
        </summary>
        <div className="grid gap-2">
          {items.map((chain) => {
            const demo = demoCard(chain);
            return (
              demo && (
                <Card key={chain.id} className="grid gap-2 p-3">
                  <strong>{demo.title}</strong>
                  {demo.summary && <span>{demo.summary}</span>}
                  {wake && chain.snoozedUntil && (
                    <span>
                      Wakes{' '}
                      {new Intl.DateTimeFormat(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(chain.snoozedUntil))}
                    </span>
                  )}
                  <Button
                    variant="retro"
                    type="button"
                    onClick={() => void action(chain).then(load)}
                  >
                    {verb(chain)}
                  </Button>
                </Card>
              )
            );
          })}
        </div>
      </details>
    ) : null;
  return (
    <div className="mx-auto grid max-w-[1100px] gap-5">
      <h1>Demos</h1>
      {grid.length === 0 && <p>Nothing to try yet.</p>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5">
        {grid.map((chain) => {
          const demo = demoCard(chain);
          return (
            demo && (
              <Card
                asChild
                variant="bevel"
                data-tone={
                  demo.status === 'ready' ? 'ok' : demo.status === 'building' ? 'accent' : 'bad'
                }
                key={chain.id}
              >
                <article className="demo-card grid min-w-0 content-start gap-3 p-5">
                  <DemoBody chain={chain} demo={demo} reload={load} />
                </article>
              </Card>
            )
          );
        })}
      </div>
      {fold('Snoozed', snoozed, (chain) => unsnoozeChain(chain.id), () => 'Unsnooze', true)}
      {fold('Hidden', hidden, (chain) => reopenChain(chain.id), (chain) =>
        chain.questId !== null && doneQuests.has(chain.questId)
          ? 'Show again (reopens the quest)'
          : 'Show again',
      )}
    </div>
  );
}

function DemoPlayer({ id }: { id: string }) {
  const [found, setFound] = useState<{ chain: Chain; demo: DemoCard } | null | undefined>();
  const navigate = useNavigate();
  const iframe = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    void listChains({ kind: 'demo', status: 'all', includeSnoozed: true })
      .then((chains) => {
        const chain = chains.find((item) => item.demoId === id);
        const demo = chain && demoCard(chain);
        setFound(chain && demo ? { chain, demo } : null);
      })
      .catch(() => setFound(null));
  }, [id]);
  if (found === undefined) return null;
  if (found === null)
    return (
      <div className="grid gap-4">
        <p>That demo isn't here.</p>
        <Button asChild variant="retro">
          <Link to="/demos">Back to demos</Link>
        </Button>
      </div>
    );
  const { chain, demo } = found;
  if (demo.demoKind !== 'disc')
    return (
      <div className="grid gap-4">
        <Button asChild variant="retro">
          <Link to="/demos">Back to demos</Link>
        </Button>
        <Card asChild variant="bevel">
          <article className="demo-card grid min-w-0 gap-3 p-5">
            <DemoBody chain={chain} demo={demo} reload={() => navigate('/demos')} />
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
