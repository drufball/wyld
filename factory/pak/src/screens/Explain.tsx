import type { Artifact, ArtifactWithHtml, Chain } from '@wyld/shared';
import { MapPin } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { getArtifact, listChains, postChain } from '../api/client.js';
import { ChainCard } from '../components/ChainList.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Textarea } from '../components/ui/textarea.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { createPinBridge, type PinPick, type PinRect } from '../lib/pin-bridge.js';

type LoadedArtifact = Artifact | ArtifactWithHtml;
type Bridge = ReturnType<typeof createPinBridge>;

function ArtifactViewer({
  slug,
  missing,
  back,
}: {
  slug: string;
  missing: ReactNode;
  back: (artifact: LoadedArtifact) => ReactNode;
}) {
  const [artifact, setArtifact] = useState<LoadedArtifact | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pick, setPick] = useState<PinPick | null>(null);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const [pins, setPins] = useState<Chain[]>([]);
  const [rects, setRects] = useState<Record<string, PinRect>>({});
  const [openChain, setOpenChain] = useState<number | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<Bridge | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const { subscribe } = useLiveEvents();

  const loadPins = useCallback(
    () =>
      void listChains({ artifact: slug })
        .then((items) =>
          setPins(
            items
              .filter((chain) => chain.anchor !== null)
              .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
          ),
        )
        .catch(() => undefined),
    [slug],
  );
  useEffect(() => {
    let current = true;
    const refresh = () =>
      void getArtifact(slug)
        .then((loaded) => current && setArtifact(loaded))
        .catch(() => current && setArtifact(null));
    setArtifact(undefined);
    refresh();
    loadPins();
    const stops = [
      subscribe('planner.artifact_published', (event) => {
        if (event.payload.slug === slug) refresh();
      }),
      subscribe('planner.chain_updated', loadPins),
      subscribe('human.chain_closed', loadPins),
    ];
    return () => {
      current = false;
      stops.forEach((stop) => stop());
    };
  }, [slug, subscribe, loadPins]);
  const version = artifact?.version;
  useEffect(() => {
    setReady(false);
    setPinMode(false);
    setPick(null);
    setRects({});
    if (!frame.current || version === undefined) return;
    const next = createPinBridge({
      frame: frame.current,
      onReady: () => setReady(true),
      onPick: (value) => {
        setOpenChain(null);
        setPick(value);
      },
      onRects: setRects,
    });
    bridge.current = next;
    return () => {
      next.stop();
      if (bridge.current === next) bridge.current = null;
    };
  }, [slug, version]);
  useEffect(() => {
    if (ready)
      bridge.current?.locate(pins.flatMap((chain) => (chain.anchor ? [chain.anchor.element] : [])));
  }, [pins, ready]);
  useEffect(() => {
    if (pick) field.current?.focus();
  }, [pick]);
  useLayoutEffect(() => {
    if (field.current) {
      field.current.style.height = 'auto';
      field.current.style.height = `${field.current.scrollHeight + field.current.offsetHeight - field.current.clientHeight}px`;
    }
  }, [text]);
  useEffect(() => {
    if (!pick && openChain === null) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPick(null);
        setOpenChain(null);
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [pick, openChain]);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const message = text.trim();
    if (!message || !pick) return;
    setFailed(false);
    void postChain(message, undefined, {
      artifact: slug,
      element: pick.element,
      label: pick.label.slice(0, 80),
    })
      .then((chain) => {
        const next = [...pins, chain].sort(
          (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
        );
        setPins(next);
        setText('');
        setPick(null);
        setPinMode(false);
        bridge.current?.setMode(false);
        bridge.current?.locate(next.flatMap((item) => (item.anchor ? [item.anchor.element] : [])));
      })
      .catch(() => setFailed(true));
  };
  if (artifact === undefined) return null;
  if (artifact === null) return missing;
  const closeOverlay = () => {
    setPick(null);
    setOpenChain(null);
  };
  const selected = pins.find(({ id }) => id === openChain);
  const panelClass =
    'fixed bottom-[calc(53px+env(safe-area-inset-bottom))] left-0 right-0 z-40 grid gap-3 p-5 md:bottom-24 md:left-auto md:right-6 md:w-[min(32rem,calc(100vw-3rem))]';
  return (
    <section className="fixed inset-x-0 top-0 bottom-[72px] z-10 flex flex-col bg-card md:static md:z-auto md:h-[calc(100dvh-180px)]">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="shrink-0">{back(artifact)}</span>
        <h1 className="m-0 min-w-0 flex-1 truncate text-base sm:flex-none">{artifact.title}</h1>
        <p className="m-0 hidden min-w-0 flex-1 truncate text-muted-foreground sm:block">
          {artifact.summary}
        </p>
        <Button
          variant="retro"
          size="icon"
          type="button"
          aria-label="Pin a comment"
          aria-disabled={!ready ? 'true' : undefined}
          aria-pressed={ready ? pinMode : false}
          title={ready ? 'Pin a comment' : "This explainer can't take pins yet"}
          onClick={() => {
            if (!ready) return;
            const next = !pinMode;
            setPinMode(next);
            bridge.current?.setMode(next);
            if (!next) setPick(null);
          }}
        >
          <MapPin size={20} aria-hidden />
        </Button>
        <Badge variant="tone" className="shrink-0">
          v{artifact.version}
        </Badge>
      </header>
      <div className="relative min-h-0 flex-1">
        <iframe
          ref={frame}
          className="h-full w-full border-0"
          src={`/artifacts/${encodeURIComponent(slug)}/?v=${artifact.version}`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          title={artifact.title}
          loading="eager"
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {pins.map((chain, index) => {
            if (!chain.anchor) return null;
            const r = rects[chain.anchor.element];
            if (!r) return null;
            const overlapping = pins
              .slice(0, index)
              .filter((item) => item.anchor?.element === chain.anchor?.element).length;
            const x = r.x + r.w - overlapping * 44;
            const y = r.y;
            const box = frame.current?.getBoundingClientRect();
            if (box && (x < 0 || y < 0 || x > box.width || y > box.height)) return null;
            return (
              <button
                key={chain.id}
                type="button"
                className="pointer-events-auto absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: x, top: y }}
                aria-label={`Pinned comment ${index + 1}: ${chain.anchor.label}`}
                aria-pressed={openChain === chain.id}
                onClick={() => {
                  setPick(null);
                  setOpenChain(chain.id);
                }}
              >
                <span className="flex size-8 items-center justify-center rounded-full border border-border bg-accent text-accent-foreground">
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {(pick || selected) && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 min-h-11 bg-black/60 backdrop-blur-sm"
            aria-label={pick ? 'Close pin comment' : 'Close pinned comment'}
            onClick={closeOverlay}
          />
          {pick ? (
            <Card
              variant="bevel"
              role="dialog"
              aria-modal="true"
              aria-label="Pin a comment"
              className={panelClass}
            >
              <p className="m-0 wrap-anywhere">Pinned to: {pick.label}</p>
              <form className="grid gap-3" onSubmit={submit}>
                <Textarea
                  ref={field}
                  rows={1}
                  value={text}
                  className="resize-none overflow-hidden"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                {failed && (
                  <p className="m-0 text-destructive">
                    That didn't go through.{' '}
                    <Button variant="ghost" type="button" onClick={() => submit()}>
                      Retry
                    </Button>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Send</Button>
                  <Button variant="retro" type="button" onClick={closeOverlay}>
                    Close
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            selected && (
              <Card
                variant="bevel"
                role="dialog"
                aria-modal="true"
                aria-label="Pinned comment"
                className={panelClass}
              >
                <ChainCard
                  chain={selected}
                  showQuestChip={false}
                  defaultOpen
                  onChange={(changed) =>
                    setPins((items) =>
                      items.map((item) => (item.id === changed.id ? changed : item)),
                    )
                  }
                  onClosed={(id) => {
                    setPins((items) => items.filter((item) => item.id !== id));
                    setOpenChain(null);
                  }}
                  onSnoozed={(id) => {
                    setPins((items) => items.filter((item) => item.id !== id));
                    setOpenChain(null);
                  }}
                />
                <Button variant="retro" type="button" onClick={closeOverlay}>
                  Close
                </Button>
              </Card>
            )
          )}
        </>
      )}
    </section>
  );
}

const explainMissing = (
  <Card variant="bevel" className="p-5">
    <h1>Explainer</h1>
    <p>That explainer isn't here yet.</p>
    <Button variant="retro" asChild>
      <Link to="/quests">Back to quests</Link>
    </Button>
  </Card>
);
export function Explain() {
  const { slug } = useParams();
  if (!slug) return explainMissing;
  return (
    <ArtifactViewer
      slug={slug}
      missing={explainMissing}
      back={(artifact) => (
        <Button variant="retro" asChild>
          <Link
            to={
              artifact.questId ? `/quests?quest=${encodeURIComponent(artifact.questId)}` : '/quests'
            }
          >
            Back
          </Link>
        </Button>
      )}
    />
  );
}
export function Roadmap() {
  return (
    <ArtifactViewer
      slug="roadmap"
      missing={
        <Card variant="bevel" className="p-5">
          <h1>Roadmap</h1>
          <p>The roadmap explainer isn't written yet — it arrives with the next piece.</p>
        </Card>
      }
      back={() => (
        <Button variant="retro" asChild>
          <Link to="/">Back</Link>
        </Button>
      )}
    />
  );
}
