import type { Chain } from '@wyld/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { closeChain, listChains, listQuests, postChainMessage } from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';

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
    <article className="chain-card">
      {showQuestChip && chain.questId !== null && (
        <span className="world-tag">{questName ?? chain.questId}</span>
      )}
      <div className="chain-card__notes" aria-live="polite">
        {chain.messages.map((message) => (
          <p key={message.id}>
            <strong>{message.author === 'planner' ? 'Fable' : 'You'}</strong>{' '}
            <span className="pak-dim">· {noteDate(message.ts)}</span>
            <br />
            {message.text}
          </p>
        ))}
      </div>
      {waiting && (
        <p className="chain-card__thinking" aria-live="polite">
          Fable's thinking…
        </p>
      )}
      <form onSubmit={submit}>
        <label htmlFor={`chain-follow-up-${chain.id}`}>Follow up</label>
        <span className="chain-card__input">
          <textarea
            ref={field}
            id={`chain-follow-up-${chain.id}`}
            rows={1}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit">Send</button>
        </span>
      </form>
      <div className="chain-card__actions">
        <button type="button" onClick={() => close('settled')}>
          Settled
        </button>
        {onConvert && (
          <button type="button" onClick={() => close('converted')}>
            Make this a quest
          </button>
        )}
      </div>
      {failedAction !== null && (
        <p className="quest-retry">
          That didn't go through.{' '}
          <button type="button" onClick={failedAction}>
            Retry
          </button>
        </p>
      )}
    </article>
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
    void listQuests()
      .then((quests) =>
        setQuestNames(Object.fromEntries(quests.map(({ id, title }) => [id, title]))),
      )
      .catch(() => undefined);
  }, [load]);
  useEffect(() => {
    const unsubscribe = [
      subscribe('human.question', load),
      subscribe('planner.chain_updated', load),
      subscribe('human.chain_closed', load),
    ];
    return () => unsubscribe.forEach((stop) => stop());
  }, [load, subscribe]);
  useEffect(() => {
    if (addedChain)
      setChains((current) =>
        current.some(({ id }) => id === addedChain.id) ? current : [...current, addedChain],
      );
  }, [addedChain]);
  if (chains.length === 0) return null;
  return (
    <section className="today-chains" aria-label="Open questions">
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
