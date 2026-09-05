import type { Chain } from '@wyld/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { closeChain, listChains, listQuests, postChainMessage } from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { Badge } from './ui/badge.js';
import { Button } from './ui/button.js';
import { Card } from './ui/card.js';
import { Textarea } from './ui/textarea.js';

function noteDate(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(timestamp),
  );
}

export function ChainCard({
  chain,
  questName,
  onChange,
  onClosed,
  onConvert,
  showQuestChip = true,
}: {
  chain: Chain;
  questName?: string;
  onChange: (chain: Chain) => void;
  onClosed: (id: number) => void;
  onConvert?: (text: string) => void;
  showQuestChip?: boolean;
}) {
  const [text, setText] = useState('');
  const [failedAction, setFailedAction] = useState<(() => void) | null>(null);
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

  return (
    <Card className="chain-card grid min-w-0 gap-3 border-l-2 border-l-accent p-5">
      {showQuestChip && chain.questId !== null && (
        <Badge variant="tone" data-tone="accent">
          {questName ?? chain.questId}
        </Badge>
      )}
      <div className="grid gap-2" aria-live="polite">
        {chain.messages.map((message) => (
          <p className="m-0 wrap-anywhere whitespace-pre-wrap bg-muted p-2" key={message.id}>
            <strong>{message.author === 'planner' ? 'Fable' : 'You'}</strong>{' '}
            <span className="text-muted-foreground">· {noteDate(message.ts)}</span>
            <br />
            {message.text}
          </p>
        ))}
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
        <Button variant="retro" type="button" onClick={() => close('settled')}>
          Settled
        </Button>
        {onConvert && (
          <Button variant="retro" type="button" onClick={() => close('converted')}>
            Make this a quest
          </Button>
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
  onConvert,
  showQuestChip = true,
  addedChain,
}: {
  quest?: string;
  onConvert?: (text: string) => void;
  showQuestChip?: boolean;
  addedChain?: Chain | null;
}) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [questNames, setQuestNames] = useState<Record<string, string>>({});
  const { subscribe } = useLiveEvents();
  const load = useCallback(
    () =>
      void listChains({ quest })
        .then(setChains)
        .catch(() => undefined),
    [quest],
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
    ];
    return () => unsubscribe.forEach((stop) => stop());
  }, [load, quest, subscribe]);
  useEffect(() => {
    if (addedChain)
      setChains((current) =>
        current.some(({ id }) => id === addedChain.id) ? current : [...current, addedChain],
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
          onConvert={onConvert}
          showQuestChip={showQuestChip}
        />
      ))}
    </section>
  );
}
