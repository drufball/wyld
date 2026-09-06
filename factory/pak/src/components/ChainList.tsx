import type { Chain } from '@wyld/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import {
  closeChain,
  decideRumble,
  listChains,
  listQuests,
  postChainMessage,
  snoozeChain,
  unsnoozeChain,
} from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';
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

export function ChainCard({
  chain,
  questName,
  onChange,
  onClosed,
  onSnoozed,
  onConvert,
  showQuestChip = true,
  rumbleCard = false,
}: {
  chain: Chain;
  questName?: string;
  onChange: (chain: Chain) => void;
  onClosed: (id: number) => void;
  onSnoozed?: (id: number) => void;
  onConvert?: (text: string) => void;
  showQuestChip?: boolean;
  rumbleCard?: boolean;
}) {
  const [text, setText] = useState('');
  const [failedAction, setFailedAction] = useState<(() => void) | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [asking, setAsking] = useState(!rumbleCard);
  const [deciding, setDeciding] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
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
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    act(
      () => postChainMessage(chain.id, message),
      (updated) => {
        setText('');
        setExpanded(false);
        onChange(updated);
      },
    );
  };
  const close = (reason: 'settled' | 'converted') =>
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
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')
          navigator.vibrate([40, 30, 40]);
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
  const content = (
    <>
      <div className="flex flex-wrap gap-2">
        {(!rumbleCard || chain.kind !== 'rumble') && (
          <Badge variant="tone" data-tone="accent">
            {chain.kind}
          </Badge>
        )}
        {chain.kind === 'rumble' && chain.rumble !== null && (
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
            aria-expanded={expanded}
            aria-controls={`chain-earlier-${chain.id}`}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? `Hide ${earlierCount} earlier messages`
              : `${earlierCount} earlier messages`}
          </Button>
        )}
        {earlierCount > 0 && expanded && (
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
      {chain.kind === 'rumble' && rumbleCard && (
        <Button variant="retro" type="button" onClick={() => setAsking((value) => !value)}>
          Ask for more
        </Button>
      )}
      {asking && (
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
      )}
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
      {failedAction !== null && (
        <p className="m-0 text-destructive">
          That didn't go through.{' '}
          <Button variant="ghost" type="button" onClick={failedAction}>
            Retry
          </Button>
        </p>
      )}
    </>
  );
  return rumbleCard ? (
    <Card asChild variant="bevel" data-tone={chain.rumble?.kind === 'outage' ? 'bad' : 'accent'}>
      <article className="rumble-card chain-card grid min-w-0 gap-3 p-5">{content}</article>
    </Card>
  ) : (
    <Card className="chain-card grid min-w-0 gap-3 border-l-2 border-l-accent p-5">{content}</Card>
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
  kind?: 'question' | 'message' | 'rumble' | 'all';
  onConvert?: (text: string) => void;
  showQuestChip?: boolean;
  addedChain?: Chain | null;
}) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [questNames, setQuestNames] = useState<Record<string, string>>({});
  const { subscribe } = useLiveEvents();
  const load = useCallback(
    () =>
      void listChains({ quest, kind })
        .then(setChains)
        .catch(() => undefined),
    [quest, kind],
  );
  useEffect(() => {
    load();
    if (!showQuestChip) return;
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
    if (addedChain)
      setChains((current) =>
        current.some(({ id }) => id === addedChain.id) ? current : [addedChain, ...current],
      );
  }, [addedChain]);
  if (chains.length === 0) return null;
  const remove = (id: number) => setChains((current) => current.filter((item) => item.id !== id));
  return (
    <section className="grid gap-3" aria-label="Open questions">
      {chains.map((chain) => (
        <ChainCard
          key={chain.id}
          chain={chain}
          questName={chain.questId === null ? undefined : questNames[chain.questId]}
          onChange={(changed) =>
            setChains((current) => current.map((item) => (item.id === changed.id ? changed : item)))
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
