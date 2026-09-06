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
import { Badge } from './ui/badge.js';
import { Button } from './ui/button.js';
import { Card } from './ui/card.js';
import { Textarea } from './ui/textarea.js';
import { DecisionButtons } from './DecisionButtons.js';

function noteDate(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(timestamp),
  );
}

function snoozeDate(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function ChainCard({
  chain,
  questName,
  onChange,
  onClosed,
  onSnoozed,
  onConvert,
  showQuestChip = true,
}: {
  chain: Chain;
  questName?: string;
  onChange: (chain: Chain) => void;
  onClosed: (id: number) => void;
  onSnoozed?: (id: number) => void;
  onConvert?: (text: string) => void;
  showQuestChip?: boolean;
}) {
  const [text, setText] = useState('');
  const [failedAction, setFailedAction] = useState<(() => void) | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
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
  const send = (message: string) =>
    act(
      () => postChainMessage(chain.id, message),
      (updated) => {
        setText('');
        setExpanded(false);
        onChange(updated);
      },
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (message) send(message);
  };
  const close = (reason: 'settled' | 'converted') =>
    act(
      () => closeChain(chain.id, reason),
      () => {
        onClosed(chain.id);
        if (reason === 'converted') {
          onConvert?.(chain.messages.find(({ author }) => author === 'human')?.text ?? '');
        }
      },
    );
  const waiting = chain.messages.at(-1)?.author === 'human';
  const hiddenCount = Math.max(0, chain.messages.length - 2);
  const hidden = chain.messages.slice(0, hiddenCount);
  const visible = chain.messages.slice(hiddenCount);
  const snoozed = chain.snoozedUntil !== null && new Date(chain.snoozedUntil) > new Date();
  const snooze = (until: Date) =>
    act(
      () => snoozeChain(chain.id, until.toISOString()),
      () => onSnoozed?.(chain.id),
    );
  const preset = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(8, 0, 0, 0);
    return date;
  };
  const renderMessage = (message: Chain['messages'][number]) => (
    <p className="m-0 wrap-anywhere whitespace-pre-wrap bg-muted p-2" key={message.id}>
      <strong>{message.author === 'planner' ? 'Fable' : 'You'}</strong>{' '}
      <span className="text-muted-foreground">· {noteDate(message.ts)}</span>
      <br />
      {message.text}
    </p>
  );

  return (
    <Card className="chain-card grid min-w-0 gap-3 border-l-2 border-l-accent p-5">
      <div className="flex flex-wrap gap-2">
        <Badge
          variant="tone"
          data-tone={chain.kind === 'rumble' && chain.rumble?.kind === 'outage' ? 'bad' : 'accent'}
        >
          {chain.kind}
        </Badge>
        {showQuestChip && chain.questId !== null && (
          <Badge variant="tone" data-tone="accent">
            {questName ?? chain.questId}
          </Badge>
        )}
      </div>
      {chain.rumble && (
        <>
          <h2 className="m-0 wrap-anywhere text-xl leading-snug">{chain.rumble.title}</h2>
          <p className="m-0 wrap-anywhere whitespace-pre-line text-muted-foreground">
            {chain.rumble.context}
          </p>
          <DecisionButtons
            id={chain.rumble.id}
            options={chain.rumble.options}
            deciding={deciding}
            failed={null}
            decide={(id, chosen) => {
              setDeciding(true);
              void decideRumble(id, chosen)
                .then(() => onClosed(chain.id))
                .catch(() => setFailedAction(() => () => undefined))
                .finally(() => setDeciding(false));
            }}
          />
        </>
      )}
      <div className="grid gap-2" aria-live="polite">
        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            type="button"
            className="w-full"
            aria-expanded={expanded}
            aria-controls={`earlier-messages-${chain.id}`}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? `Hide ${hiddenCount} earlier messages` : `${hiddenCount} earlier messages`}
          </Button>
        )}
        {hiddenCount > 0 && (
          <div id={`earlier-messages-${chain.id}`} className={expanded ? 'grid gap-2' : 'hidden'}>
            {hidden.map(renderMessage)}
          </div>
        )}
        {visible.map(renderMessage)}
      </div>
      {waiting && (
        <p className="m-0 text-muted-foreground" aria-live="polite">
          Fable's thinking…
        </p>
      )}
      <form className="grid gap-2" onSubmit={submit}>
        <label htmlFor={`chain-follow-up-${chain.id}`}>Follow up</label>
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
      <div className="flex flex-wrap gap-2">
        {snoozed ? (
          <>
            <span className="self-center text-muted-foreground">
              Snoozed until {snoozeDate(chain.snoozedUntil!)}
            </span>
            <Button
              variant="retro"
              type="button"
              onClick={() => act(() => unsnoozeChain(chain.id), onChange)}
            >
              Unsnooze
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="retro"
              type="button"
              aria-expanded={showSnooze}
              onClick={() => setShowSnooze((value) => !value)}
            >
              Snooze
            </Button>
            {showSnooze && (
              <>
                <Button
                  variant="retro"
                  type="button"
                  onClick={() => snooze(new Date(Date.now() + 4 * 60 * 60 * 1000))}
                >
                  Later today
                </Button>
                <Button variant="retro" type="button" onClick={() => snooze(preset(1))}>
                  Tomorrow morning
                </Button>
                <Button variant="retro" type="button" onClick={() => snooze(preset(7))}>
                  Next week
                </Button>
              </>
            )}
          </>
        )}
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
      </div>
      {failedAction !== null && (
        <p className="m-0 text-destructive">
          That didn't go through.{' '}
          <Button variant="ghost" type="button" onClick={failedAction}>
            Retry
          </Button>
        </p>
      )}
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
          onClosed={(id) => setChains((current) => current.filter((item) => item.id !== id))}
          onSnoozed={(id) => setChains((current) => current.filter((item) => item.id !== id))}
          onConvert={onConvert}
          showQuestChip={showQuestChip}
        />
      ))}
    </section>
  );
}
