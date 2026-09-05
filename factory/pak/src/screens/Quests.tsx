import { type Chain, type Event, type Quest, type QuestNote, type QuestStatus } from '@wyld/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getQuest,
  listQuests,
  listWorlds,
  patchQuestStatus,
  postChain,
  postQuestNote,
} from '../api/client.js';
import { ChainList } from '../components/ChainList.js';
import { useLiveEvents } from '../live/LiveEvents.js';

function AskComposer({ questId, onSent }: { questId: string; onSent: (chain: Chain) => void }) {
  const [text, setText] = useState('');
  const [failedText, setFailedText] = useState<string | null>(null);
  const askField = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = askField.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
  }, [text]);

  const send = (noteText: string) => {
    setFailedText(null);
    void postChain(noteText, questId)
      .then((chain) => {
        setText('');
        onSent(chain);
      })
      .catch(() => setFailedText(noteText));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const noteText = text.trim();
    if (noteText) send(noteText);
  };

  return (
    <div className="ask-composer">
      <form onSubmit={submit}>
        <label htmlFor={`ask-${questId}`}>Ask about this quest</label>
        <span className="ask-composer__input">
          <textarea
            ref={askField}
            id={`ask-${questId}`}
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
      {failedText !== null && (
        <p className="quest-retry">
          That didn't go through.{' '}
          <button type="button" onClick={() => send(failedText)}>
            Retry
          </button>
        </p>
      )}
    </div>
  );
}

export function QuestCard({
  quest,
  worldName,
  onChange,
}: {
  quest: Quest;
  worldName: string;
  onChange: (quest: Quest) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [newChain, setNewChain] = useState<Chain | null>(null);
  const [nudged, setNudged] = useState(false);
  const [failedAction, setFailedAction] = useState<(() => void) | null>(null);
  const previousStatus = useRef<QuestStatus>('building');
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const act = (action: () => Promise<Quest | QuestNote>, onSuccess?: () => void) => {
    setFailedAction(null);
    void action()
      .then((result) => {
        if ('progress' in result) onChange(result);
        onSuccess?.();
      })
      .catch(() => setFailedAction(() => () => act(action, onSuccess)));
  };
  useEffect(() => () => clearTimeout(nudgeTimer.current), []);
  const acknowledgeNudge = () => {
    setNudged(true);
    clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudged(false), 3000);
  };
  const parked = quest.status === 'parked';
  const togglePark = () => {
    if (!parked) previousStatus.current = quest.status === 'idea' ? 'idea' : 'building';
    return patchQuestStatus(quest.id, parked ? previousStatus.current : 'parked');
  };

  return (
    <article className="quest-card">
      <header>
        <div>
          <div className="quest-card__heading">
            <h2>{quest.title}</h2>
            <span className="world-tag">{worldName}</span>
          </div>
          <p>{quest.pitch}</p>
        </div>
        <span className={`quest-status quest-status--${quest.status}`}>{quest.status}</span>
      </header>
      <div
        className="quest-progress"
        role="progressbar"
        aria-label={`${quest.title} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(quest.progress * 100)}
      >
        <span style={{ width: `${quest.progress * 100}%` }} />
      </div>
      {(quest.sinceYouLooked || (quest.lastNote && quest.lastNote.toLowerCase() !== 'nudge')) && (
        <div className="quest-context">
          {quest.sinceYouLooked && <p>{quest.sinceYouLooked}</p>}
          {quest.lastNote && quest.lastNote.toLowerCase() !== 'nudge' && <p>{quest.lastNote}</p>}
        </div>
      )}
      <div className="quest-actions">
        <button
          type="button"
          onClick={() =>
            act(
              () => postQuestNote(quest.id, { author: 'human', text: 'Nudge', intent: 'nudge' }),
              acknowledgeNudge,
            )
          }
        >
          Nudge
        </button>
        <button type="button" onClick={() => act(togglePark)}>
          {parked ? 'Unpark' : 'Park'}
        </button>
        {quest.status !== 'done' && !parked && (
          <button type="button" onClick={() => act(() => patchQuestStatus(quest.id, 'done'))}>
            Done
          </button>
        )}
        <button type="button" aria-expanded={asking} onClick={() => setAsking((value) => !value)}>
          Ask
        </button>
        <span className="quest-demo">
          <button type="button" disabled>
            Demo
          </button>{' '}
          <small>not yet</small>
        </span>
      </div>
      {nudged && (
        <p className="today-ack" aria-live="polite">
          Nudged. Fable's on it.
        </p>
      )}
      {failedAction !== null && (
        <p className="quest-retry">
          That didn't go through. <button onClick={failedAction}>Retry</button>
        </p>
      )}
      {asking && (
        <AskComposer
          questId={quest.id}
          onSent={(chain) => {
            setNewChain(chain);
            setAsking(false);
          }}
        />
      )}
      <ChainList quest={quest.id} showQuestChip={false} addedChain={newChain} />
    </article>
  );
}

const liveKinds = [
  'planner.quest_updated',
  'planner.note',
  'human.nudge',
  'human.ask',
  'human.park',
] as const;

type StatusFilter = 'all' | 'ideas' | 'building' | 'done' | 'parked';

const statusFilters: { id: StatusFilter; label: string; statuses?: QuestStatus[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'ideas', label: 'Ideas', statuses: ['idea', 'planning'] },
  { id: 'building', label: 'Building', statuses: ['building', 'demo'] },
  { id: 'done', label: 'Done', statuses: ['done'] },
  { id: 'parked', label: 'Parked', statuses: ['parked'] },
];

export function Quests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedWorld = searchParams.get('world') ?? 'all';
  const selectedQuestId = searchParams.get('quest');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [worlds, setWorlds] = useState<Awaited<ReturnType<typeof listWorlds>>>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [doneExpanded, setDoneExpanded] = useState(false);
  const { subscribe } = useLiveEvents();
  const replaceQuest = useCallback((quest: Quest) => {
    setQuests((current) => {
      const exists = current.some((item) => item.id === quest.id);
      if (exists) return current.map((item) => (item.id === quest.id ? quest : item));
      return [...current, quest].sort((left, right) => left.id.localeCompare(right.id));
    });
  }, []);
  const refreshQuest = useCallback(
    (event: Event) => {
      if (event.questId)
        void getQuest(event.questId)
          .then(replaceQuest)
          .catch(() => undefined);
    },
    [replaceQuest],
  );

  useEffect(() => {
    void listWorlds()
      .then(setWorlds)
      .catch(() => setWorlds([]));
    void listQuests()
      .then(setQuests)
      .catch(() => setQuests([]));
  }, []);
  useEffect(() => {
    const unsubscribes = liveKinds.map((kind) => subscribe(kind, refreshQuest));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [refreshQuest, subscribe]);

  const selectedStatuses = statusFilters.find((filter) => filter.id === status)?.statuses;
  const filtered = quests.filter(
    (quest) =>
      (selectedWorld === 'all' || quest.worldId === selectedWorld) &&
      (!selectedStatuses || selectedStatuses.includes(quest.status)),
  );
  const activeQuests =
    status === 'all' ? filtered.filter((quest) => quest.status !== 'done') : filtered;
  const doneQuests = status === 'all' ? filtered.filter((quest) => quest.status === 'done') : [];
  const worldNames = new Map(worlds.map((world) => [world.id, world.name]));
  const selectedQuest = quests.find((quest) => quest.id === selectedQuestId);
  const chooseWorld = (worldId: string) => {
    setDoneExpanded(false);
    setSearchParams(worldId === 'all' ? {} : { world: worldId });
  };

  return (
    <section className="world-quests">
      <h1>Quests</h1>
      {selectedQuest ? (
        <div className="quest-list">
          <QuestCard
            quest={selectedQuest}
            worldName={worldNames.get(selectedQuest.worldId) ?? selectedQuest.worldId}
            onChange={replaceQuest}
          />
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('quest');
              setSearchParams(next);
            }}
          >
            Show all quests
          </button>
        </div>
      ) : (
        <>
          <div className="quest-filters">
            <div className="quest-filter" aria-label="World filter">
              <strong>World</strong>
              {[{ id: 'all', name: 'All' }, ...worlds].map((world) => (
                <button
                  key={world.id}
                  type="button"
                  aria-pressed={selectedWorld === world.id}
                  onClick={() => chooseWorld(world.id)}
                >
                  {world.name}
                </button>
              ))}
            </div>
            <div className="quest-filter" aria-label="Status filter">
              <strong>Status</strong>
              {statusFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={status === filter.id}
                  onClick={() => {
                    setStatus(filter.id);
                    setDoneExpanded(false);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="quest-list">
            {activeQuests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                worldName={worldNames.get(quest.worldId) ?? quest.worldId}
                onChange={replaceQuest}
              />
            ))}
            {doneQuests.length > 0 && (
              <section className="done-quests">
                <button
                  className="done-quests__toggle"
                  type="button"
                  aria-expanded={doneExpanded}
                  onClick={() => setDoneExpanded((expanded) => !expanded)}
                >
                  Done ({doneQuests.length})
                </button>
                {doneExpanded &&
                  doneQuests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      worldName={worldNames.get(quest.worldId) ?? quest.worldId}
                      onChange={replaceQuest}
                    />
                  ))}
              </section>
            )}
          </div>
          {filtered.length === 0 && <p className="pak-dim">No quests match these filters.</p>}
        </>
      )}
    </section>
  );
}
