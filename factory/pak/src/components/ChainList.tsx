import type { Chain, ChainKind } from '@wyld/shared';
import { Ellipsis, Pin } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import {
  closeChain,
  decideRumble,
  listChains,
  listArtifacts,
  listQuests,
  postChainMessage,
  pinChain,
  snoozeChain,
  unsnoozeChain,
  unpinChain,
} from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { briefingCard, lookCard, unlockCard, type BriefingCard } from '../lib/chain-cards.js';
import { DecisionButtons } from './DecisionButtons.js';
import { Badge } from './ui/badge.js';
import { Button } from './ui/button.js';
import { Card } from './ui/card.js';
import { Textarea } from './ui/textarea.js';

function noteDate(timestamp: string, withTime = false) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(timestamp));
}

function presetDate(preset: 'later' | 'tomorrow' | 'week') {
  const date = new Date();
  if (preset === 'later') date.setHours(date.getHours() + 4);
  else {
    date.setDate(date.getDate() + (preset === 'tomorrow' ? 1 : 7));
    date.setHours(8, 0, 0, 0);
  }
  return date.toISOString();
}

function PinnedIndicator({ chain }: { chain: Chain }) {
  return chain.pinnedAt === null ? null : (
    <span className="inline-flex items-center gap-1">
      <Pin size={14} aria-hidden />
      <span className="sr-only">Pinned</span>
    </span>
  );
}

export function ChainActionsMenu({
  chain,
  onChange,
  onSnoozed,
  runAction,
  extraItems,
  onDismissOutside,
  containerRef,
}: {
  chain: Chain;
  onChange: (chain: Chain) => void;
  onSnoozed?: (id: number) => void;
  runAction: (action: () => Promise<Chain>, success: (chain: Chain) => void) => void;
  extraItems?: (closeMenu: () => void) => ReactNode;
  onDismissOutside?: () => void;
  containerRef?: RefObject<HTMLElement | null>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const closeMenu = () => {
    setMenuOpen(false);
    setSnoozeOpen(false);
  };
  const snoozed = chain.snoozedUntil !== null && new Date(chain.snoozedUntil) > new Date();

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !menuTrigger.current?.contains(target)) {
        if (containerRef?.current?.contains(target)) onDismissOutside?.();
        closeMenu();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeMenu();
      menuTrigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef, menuOpen, onDismissOutside]);

  const chooseSnooze = (preset: 'later' | 'tomorrow' | 'week') => {
    closeMenu();
    runAction(
      () => snoozeChain(chain.id, presetDate(preset)),
      () => onSnoozed?.(chain.id),
    );
  };

  return (
    <>
      <Button
        ref={menuTrigger}
        variant="retro"
        size="icon"
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={`chain-menu-${chain.id}`}
        onClick={() => setMenuOpen((value) => !value)}
      >
        <Ellipsis size={20} aria-hidden />
      </Button>
      {menuOpen && (
        <div
          ref={menu}
          id={`chain-menu-${chain.id}`}
          role="menu"
          className="absolute right-0 bottom-full z-20 mb-1 grid w-max max-w-[calc(100vw-3rem)] gap-1 rounded-[var(--radius)] border border-border bg-popover p-1 shadow-md"
        >
          {extraItems?.(closeMenu)}
          <Button
            role="menuitem"
            variant="ghost"
            type="button"
            className="w-full justify-start"
            onClick={() => {
              closeMenu();
              runAction(
                () => (chain.pinnedAt === null ? pinChain(chain.id) : unpinChain(chain.id)),
                onChange,
              );
            }}
          >
            {chain.pinnedAt === null ? 'Pin' : 'Unpin'}
          </Button>
          {snoozed ? (
            <Button
              role="menuitem"
              variant="ghost"
              type="button"
              className="w-full justify-start"
              onClick={() => {
                closeMenu();
                runAction(() => unsnoozeChain(chain.id), onChange);
              }}
            >
              Unsnooze
            </Button>
          ) : (
            <>
              <Button
                role="menuitem"
                variant="ghost"
                type="button"
                className="w-full justify-start"
                aria-expanded={snoozeOpen}
                onClick={() => setSnoozeOpen((value) => !value)}
              >
                Snooze
              </Button>
              {snoozeOpen && (
                <>
                  <Button
                    role="menuitem"
                    variant="ghost"
                    type="button"
                    className="w-full justify-start"
                    onClick={() => chooseSnooze('later')}
                  >
                    Later today
                  </Button>
                  <Button
                    role="menuitem"
                    variant="ghost"
                    type="button"
                    className="w-full justify-start"
                    onClick={() => chooseSnooze('tomorrow')}
                  >
                    Tomorrow morning
                  </Button>
                  <Button
                    role="menuitem"
                    variant="ghost"
                    type="button"
                    className="w-full justify-start"
                    onClick={() => chooseSnooze('week')}
                  >
                    Next week
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

export function ChainCard({
  chain,
  questName,
  artifactName,
  defaultOpen,
  onChange,
  onClosed,
  onSnoozed,
  onConvert,
  showQuestChip = true,
  rumbleCard = false,
}: {
  chain: Chain;
  questName?: string;
  artifactName?: string;
  defaultOpen?: boolean;
  onChange: (chain: Chain) => void;
  onClosed: (id: number) => void;
  onSnoozed?: (id: number) => void;
  onConvert?: (text: string) => void;
  showQuestChip?: boolean;
  rumbleCard?: boolean;
}) {
  const [text, setText] = useState('');
  const [failedAction, setFailedAction] = useState<(() => void) | null>(null);
  const collapsible = chain.kind === 'question' || chain.kind === 'message';
  const [historyOpen, setHistoryOpen] = useState(false);
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [asking, setAsking] = useState(!rumbleCard);
  const [deciding, setDeciding] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const openTrigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const suppressCardClick = useRef(false);
  const composerWasOpened = useRef(false);
  const unlockSettled = useRef(false);
  const settleUnlockRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!collapsible) return;
    if (open) {
      composerWasOpened.current = true;
      field.current?.focus();
    } else if (composerWasOpened.current) {
      openTrigger.current?.focus();
    }
  }, [collapsible, open]);
  useLayoutEffect(() => {
    if (!field.current) return;
    field.current.style.height = 'auto';
    field.current.style.height = `${field.current.scrollHeight + field.current.offsetHeight - field.current.clientHeight}px`;
  }, [text]);
  const act = (action: () => Promise<Chain>, success: (result: Chain) => void) => {
    setFailedAction(null);
    void action()
      .then(success)
      .catch(() => setFailedAction(() => () => act(action, success)));
  };
  const settleUnlock = () => {
    if (unlockSettled.current) return;
    unlockSettled.current = true;
    setFailedAction(null);
    void closeChain(chain.id, 'settled', 'planner')
      .then(() => onClosed(chain.id))
      .catch(() =>
        setFailedAction(() => () => {
          unlockSettled.current = false;
          settleUnlockRef.current();
        }),
      );
  };
  useEffect(() => {
    settleUnlockRef.current = settleUnlock;
  });
  useEffect(() => {
    if (chain.kind !== 'unlock') return;
    let timer: number | undefined;
    const syncTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (document.visibilityState === 'visible' && !unlockSettled.current)
        timer = window.setTimeout(() => settleUnlockRef.current(), 8_000);
    };
    syncTimer();
    document.addEventListener('visibilitychange', syncTimer);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', syncTimer);
    };
  }, [chain.id, chain.kind]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    act(
      () => postChainMessage(chain.id, message),
      (updated) => {
        setText('');
        setHistoryOpen(false);
        onChange(updated);
      },
    );
  };
  const close = (reason: 'settled' | 'converted' | 'done' | 'read') =>
    act(
      () => closeChain(chain.id, reason),
      () => {
        onClosed(chain.id);
        if (reason === 'converted')
          onConvert?.(chain.messages.find(({ author }) => author === 'human')?.text ?? '');
      },
    );
  const snooze = (preset: 'later' | 'tomorrow' | 'week') =>
    act(
      () => snoozeChain(chain.id, presetDate(preset)),
      () => onSnoozed?.(chain.id),
    );
  const decide = (id: string, chosen: string) => {
    setDeciding(true);
    setFailedAction(null);
    void decideRumble(id, chosen)
      .then(() => {
        onClosed(chain.id);
      })
      .catch(() => setFailedAction(() => () => decide(id, chosen)))
      .finally(() => setDeciding(false));
  };
  const earlierCount = Math.max(0, chain.messages.length - 2);
  const earlier = chain.messages.slice(0, earlierCount);
  const visible = chain.messages.slice(earlierCount);
  const message = (item: Chain['messages'][number]) => (
    <p className="m-0 wrap-anywhere whitespace-pre-wrap bg-muted p-2" key={item.id}>
      <strong>{item.author === 'planner' ? 'Fable' : 'You'}</strong>{' '}
      <span className="text-muted-foreground">· {noteDate(item.ts)}</span>
      <br />
      {item.text}
    </p>
  );
  const snoozed = chain.snoozedUntil !== null && new Date(chain.snoozedUntil) > new Date();
  const failure = failedAction !== null && (
    <p className="m-0 text-destructive">
      That didn't go through.{' '}
      <Button variant="ghost" type="button" onClick={failedAction}>
        Retry
      </Button>
    </p>
  );
  if (chain.kind === 'demo') return null;

  if (chain.kind === 'briefing') {
    const briefing = briefingCard(chain);
    if (briefing === null) return null;
    const sections: { heading: string; lines: BriefingCard['rumbles']; links: boolean }[] = [
      { heading: 'Waiting on you', lines: briefing.rumbles, links: true },
      { heading: 'Ready to try', lines: briefing.demos, links: true },
      { heading: 'Shipped', lines: briefing.shipped, links: true },
      { heading: 'Worth knowing', lines: briefing.fyi.map((text) => ({ text })), links: false },
    ];
    return (
      <Card className="briefing-card chain-card grid min-w-0 gap-3 border-l-2 border-l-accent p-5">
        <p className="m-0 flex items-center gap-2 wrap-anywhere">
          <PinnedIndicator chain={chain} />
          {chain.messages[0]?.text}
        </p>
        <p className="m-0 text-muted-foreground">
          Updated{' '}
          {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
            new Date(briefing.updatedAt),
          )}
        </p>
        {sections.map(({ heading, lines, links }) =>
          lines.length === 0 ? null : (
            <section className="grid gap-1" key={heading}>
              <h2 className="mb-2 mt-0 font-display text-[10px] leading-loose text-accent">
                {heading}
              </h2>
              {lines.map((line, index) =>
                links && line.deepLink ? (
                  <Link
                    className="flex min-h-11 items-center rounded-[var(--radius)] px-3 py-2 text-foreground underline hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    to={line.deepLink}
                    key={index}
                  >
                    {line.text}
                  </Link>
                ) : (
                  <p className="m-0 py-2" key={index}>
                    {line.text}
                  </p>
                ),
              )}
            </section>
          ),
        )}
        {sections.every(({ lines }) => lines.length === 0) && (
          <p className="m-0">All quiet — nothing new to report.</p>
        )}
        <div className="relative flex flex-wrap gap-2">
          <Button variant="retro" type="button" onClick={() => close('read')}>
            Dismiss
          </Button>
          <ChainActionsMenu
            chain={chain}
            onChange={onChange}
            onSnoozed={onSnoozed}
            runAction={act}
          />
        </div>
        {failure}
      </Card>
    );
  }
  if (chain.kind === 'unlock') {
    const unlock = unlockCard(chain);
    if (unlock === null) return null;
    return (
      <Card
        className="chain-card unlock-card grid min-w-0 gap-3 border-l-2 border-l-accent p-5"
        onClick={(event) => {
          if (
            !(event.target as HTMLElement).closest(
              'button, a, input, textarea, select, label, [role="menu"]',
            )
          )
            settleUnlock();
        }}
      >
        <p className="m-0 flex items-center gap-2">
          <PinnedIndicator chain={chain} />
          <span aria-hidden>{unlock.badge}</span> Achievement unlocked — {unlock.name}
        </p>
        <Button variant="retro" type="button" onClick={settleUnlock}>
          Settled
        </Button>
        {failure}
      </Card>
    );
  }
  const messages = (
    <>
      <PinnedIndicator chain={chain} />
      {chain.anchor !== null && (
        <Link
          to={`/explain/${encodeURIComponent(chain.anchor.artifact)}`}
          className="m-0 min-h-11 py-2 text-muted-foreground"
        >
          <span className="wrap-anywhere">
            Pinned to {chain.anchor.label} · {artifactName ?? chain.anchor.artifact}
          </span>
        </Link>
      )}
      {chain.kind === 'rumble' && (
        <div className="flex flex-wrap gap-2">
          {!rumbleCard && (
            <Badge variant="tone" data-tone="accent">
              {chain.kind}
            </Badge>
          )}
          {chain.rumble !== null && (
            <Badge variant="tone" data-tone={chain.rumble.kind === 'outage' ? 'bad' : 'accent'}>
              {chain.rumble.kind}
            </Badge>
          )}
          {showQuestChip && chain.questId !== null && (
            <Badge variant="tone" data-tone="accent">
              {questName ?? chain.questId}
            </Badge>
          )}
        </div>
      )}
      {chain.rumble !== null && (
        <>
          <h2 className="m-0 wrap-anywhere text-xl leading-snug">{chain.rumble.title}</h2>
          <p className="m-0 wrap-anywhere whitespace-pre-line text-muted-foreground">
            {chain.rumble.context}
          </p>
          <DecisionButtons
            id={chain.rumble.id}
            options={
              chain.rumble.chosen === null
                ? chain.rumble.options
                : chain.rumble.options.filter((option) => option !== chain.rumble?.chosen)
            }
            deciding={deciding}
            failed={null}
            decide={decide}
          />
        </>
      )}
      <div className="grid gap-2" aria-live="polite">
        {earlierCount > 0 && (
          <Button
            variant="ghost"
            type="button"
            className="w-full"
            aria-expanded={historyOpen}
            aria-controls={`chain-earlier-${chain.id}`}
            onClick={() => setHistoryOpen((value) => !value)}
          >
            {historyOpen
              ? `Hide ${earlierCount} earlier messages`
              : `${earlierCount} earlier messages`}
          </Button>
        )}
        {earlierCount > 0 && historyOpen && (
          <div id={`chain-earlier-${chain.id}`} className="grid gap-2">
            {earlier.map(message)}
          </div>
        )}
        {visible.map(message)}
      </div>
      {chain.messages.at(-1)?.author === 'human' && (
        <p className="m-0 text-muted-foreground" aria-live="polite">
          Fable's thinking…
        </p>
      )}
    </>
  );
  const form = (
    <form className="grid gap-2" onSubmit={submit}>
      <label htmlFor={`chain-follow-up-${chain.id}`}>
        {rumbleCard ? 'What else do you need to know?' : 'Follow up'}
      </label>
      <span className="flex flex-wrap gap-2">
        <Textarea
          ref={field}
          id={`chain-follow-up-${chain.id}`}
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-w-0 flex-[1_1_190px] resize-none overflow-hidden"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button type="submit">Send</Button>
      </span>
    </form>
  );
  const rumbleContent = (
    <>
      {messages}
      {chain.kind === 'rumble' && rumbleCard && (
        <Button variant="retro" type="button" onClick={() => setAsking((value) => !value)}>
          Ask for more
        </Button>
      )}
      {asking && form}
      {snoozed ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">
            Snoozed until {noteDate(chain.snoozedUntil!, true)}
          </span>
          <Button
            variant="retro"
            type="button"
            onClick={() => act(() => unsnoozeChain(chain.id), onChange)}
          >
            Unsnooze
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {chain.kind !== 'rumble' && (
            <>
              <Button variant="retro" type="button" onClick={() => close('settled')}>
                Settled
              </Button>
              {onConvert && (
                <Button variant="retro" type="button" onClick={() => close('converted')}>
                  Make this a quest
                </Button>
              )}
            </>
          )}
          <Button
            variant="retro"
            type="button"
            aria-expanded={snoozeOpen}
            onClick={() => setSnoozeOpen((value) => !value)}
          >
            Snooze
          </Button>
          {snoozeOpen && (
            <>
              <Button variant="retro" type="button" onClick={() => snooze('later')}>
                Later today
              </Button>
              <Button variant="retro" type="button" onClick={() => snooze('tomorrow')}>
                Tomorrow morning
              </Button>
              <Button variant="retro" type="button" onClick={() => snooze('week')}>
                Next week
              </Button>
            </>
          )}
        </div>
      )}
      {failure}
    </>
  );
  if (!collapsible)
    return rumbleCard ? (
      <Card asChild variant="bevel" data-tone={chain.rumble?.kind === 'outage' ? 'bad' : 'accent'}>
        <article className="rumble-card chain-card grid min-w-0 gap-3 p-5">{rumbleContent}</article>
      </Card>
    ) : (
      <Card className="chain-card grid min-w-0 gap-3 border-l-2 border-l-accent p-5">
        {rumbleContent}
      </Card>
    );

  return (
    <Card
      ref={card}
      className="chain-card grid min-w-0 gap-3 border-l-2 border-l-accent p-5"
      onClick={(event) => {
        if (
          (event.target as HTMLElement).closest(
            'button, a, input, textarea, select, label, [role="menu"]',
          )
        )
          return;
        if (suppressCardClick.current) {
          suppressCardClick.current = false;
          return;
        }
        setOpen((value) => !value);
      }}
    >
      <Button
        ref={openTrigger}
        variant="retro"
        type="button"
        className="sr-only focus:not-sr-only focus:absolute focus:z-30"
        aria-expanded={open}
        aria-controls={`chain-actions-${chain.id}`}
        aria-label={open ? 'Close' : 'Reply or settle'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Close' : 'Reply or settle'}
      </Button>
      {showQuestChip && chain.questId !== null && (
        <div className="flex items-start gap-2">
          <Badge variant="tone" data-tone="accent">
            {questName ?? chain.questId}
          </Badge>
        </div>
      )}
      {messages}
      {snoozed && (
        <span className="text-muted-foreground">
          Snoozed until {noteDate(chain.snoozedUntil!, true)}
        </span>
      )}
      {open && (
        <div id={`chain-actions-${chain.id}`} className="grid gap-2">
          {form}
          <div className="relative flex flex-wrap items-center justify-end gap-2">
            {lookCard(chain) !== null && (
              <Button asChild>
                <Link to={`/explain/${encodeURIComponent(lookCard(chain)!.explainer)}`}>Look</Link>
              </Button>
            )}
            <Button variant="retro" type="button" onClick={() => close('settled')}>
              Settled
            </Button>
            <ChainActionsMenu
              chain={chain}
              onChange={onChange}
              onSnoozed={onSnoozed}
              runAction={act}
              containerRef={card}
              onDismissOutside={() => {
                suppressCardClick.current = true;
              }}
              extraItems={(closeActions) =>
                onConvert ? (
                  <Button
                    role="menuitem"
                    variant="ghost"
                    type="button"
                    className="w-full justify-start"
                    onClick={() => {
                      closeActions();
                      close('converted');
                    }}
                  >
                    Make this a quest
                  </Button>
                ) : null
              }
            />
          </div>
        </div>
      )}
      {failure}
    </Card>
  );
}

export function ChainList({
  quest,
  kind,
  onConvert,
  showQuestChip = true,
  addedChain,
}: {
  quest?: string;
  kind?: ChainKind | ChainKind[] | 'all';
  onConvert?: (text: string) => void;
  showQuestChip?: boolean;
  addedChain?: Chain | null;
}) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [questNames, setQuestNames] = useState<Record<string, string>>({});
  const [artifactNames, setArtifactNames] = useState<Record<string, string>>({});
  const { subscribe } = useLiveEvents();
  const listedKinds: ChainKind[] = useMemo(
    () =>
      kind === undefined
        ? ['question', 'message']
        : kind === 'all'
          ? ['question', 'message', 'rumble', 'unlock', 'briefing']
          : Array.isArray(kind)
            ? kind.filter((item) => item !== 'action' && item !== 'demo')
            : kind === 'action' || kind === 'demo'
              ? []
              : [kind],
    [kind],
  );
  const load = useCallback(
    () =>
      void listChains({ quest, kind: kind === undefined ? undefined : listedKinds.join(',') })
        .then((loadedChains) =>
          setChains(loadedChains.filter((chain) => listedKinds.includes(chain.kind))),
        )
        .catch(() => undefined),
    [quest, kind, listedKinds],
  );
  useEffect(() => {
    load();
    void listArtifacts()
      .then((items) =>
        setArtifactNames(Object.fromEntries(items.map(({ slug, title }) => [slug, title]))),
      )
      .catch(() => undefined);
    if (showQuestChip)
      void listQuests()
        .then((quests) =>
          setQuestNames(Object.fromEntries(quests.map(({ id, title }) => [id, title]))),
        )
        .catch(() => undefined);
  }, [load, showQuestChip]);
  useEffect(() => {
    const unsubscribe = [
      subscribe('human.question', (event) => (!quest || event.questId === quest) && load()),
      subscribe('planner.chain_updated', (event) => (!quest || event.questId === quest) && load()),
      subscribe('human.chain_closed', (event) => (!quest || event.questId === quest) && load()),
      subscribe('human.decision', load),
    ];
    return () => unsubscribe.forEach((stop) => stop());
  }, [load, quest, subscribe]);
  useEffect(() => {
    if (addedChain && listedKinds.includes(addedChain.kind))
      setChains((current) =>
        current.some(({ id }) => id === addedChain.id) ? current : [addedChain, ...current],
      );
  }, [addedChain, listedKinds]);
  if (chains.length === 0) return null;
  const remove = (id: number) => setChains((current) => current.filter((item) => item.id !== id));
  return (
    <section className="grid gap-3" aria-label="Open cards">
      {[...chains]
        .sort((left, right) => {
          if (left.pinnedAt !== null || right.pinnedAt !== null) {
            if (left.pinnedAt === null) return 1;
            if (right.pinnedAt === null) return -1;
            return Date.parse(right.pinnedAt) - Date.parse(left.pinnedAt);
          }
          const rank = (chain: Chain) =>
            chain.kind === 'rumble'
              ? chain.rumble?.kind === 'outage'
                ? 0
                : 1
              : chain.kind === 'question' || chain.kind === 'message'
                ? 2
                : 3;
          const difference = rank(left) - rank(right);
          if (difference !== 0) return difference;
          return rank(left) < 2
            ? 0
            : Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt);
        })
        .map((chain) => (
          <ChainCard
            key={chain.id}
            chain={chain}
            questName={chain.questId === null ? undefined : questNames[chain.questId]}
            artifactName={chain.anchor ? artifactNames[chain.anchor.artifact] : undefined}
            onChange={(changed) =>
              setChains((current) =>
                current.map((item) => (item.id === changed.id ? changed : item)),
              )
            }
            onClosed={remove}
            onSnoozed={remove}
            onConvert={onConvert}
            showQuestChip={showQuestChip}
          />
        ))}
    </section>
  );
}
