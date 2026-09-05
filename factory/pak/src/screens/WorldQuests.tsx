import { type Event, type Quest, type QuestNote, type QuestStatus } from '@wyld/shared';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  getQuest,
  listQuestNotes,
  listQuests,
  listWorlds,
  patchQuestStatus,
  postQuestNote,
} from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';

function noteDate(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(timestamp),
  );
}

function AskThread({ questId }: { questId: string }) {
  const [notes, setNotes] = useState<QuestNote[]>([]);
  const [text, setText] = useState('');
  const [failedText, setFailedText] = useState<string | null>(null);
  const { subscribe } = useLiveEvents();
  const load = useCallback(
    () =>
      void listQuestNotes(questId)
        .then(setNotes)
        .catch(() => undefined),
    [questId],
  );

  useEffect(() => {
    load();
    return subscribe('planner.note', (event) => {
      if (event.questId === questId) load();
    });
  }, [load, questId, subscribe]);

  const send = (noteText: string) => {
    setFailedText(null);
    void postQuestNote(questId, { author: 'human', text: noteText, intent: 'ask' })
      .then((note) => {
        setNotes((current) => [...current, note]);
        setText('');
      })
      .catch(() => setFailedText(noteText));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const noteText = text.trim();
    if (noteText) send(noteText);
  };

  return (
    <div className="ask-thread">
      <div className="ask-thread__notes" aria-live="polite">
        {notes.map((note) => (
          <p key={note.id}>
            <strong>{note.author === 'planner' ? 'Fable' : 'You'}</strong>{' '}
            <span className="pak-dim">· {noteDate(note.ts)}</span>
            <br />
            {note.text}
          </p>
        ))}
      </div>
      <form onSubmit={submit}>
        <label htmlFor={`ask-${questId}`}>Ask about this quest</label>
        <span className="ask-thread__input">
          <input
            id={`ask-${questId}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
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

export function QuestCard({ quest, onChange }: { quest: Quest; onChange: (quest: Quest) => void }) {
  const [asking, setAsking] = useState(false);
  const [failedAction, setFailedAction] = useState<(() => void) | null>(null);
  const previousStatus = useRef<QuestStatus>('building');
  const act = (action: () => Promise<Quest | QuestNote>) => {
    setFailedAction(null);
    void action()
      .then((result) => {
        if ('progress' in result) onChange(result);
      })
      .catch(() => setFailedAction(() => () => act(action)));
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
          <h2>{quest.title}</h2>
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
      {(quest.sinceYouLooked || quest.lastNote) && (
        <div className="quest-context">
          {quest.sinceYouLooked && <p>{quest.sinceYouLooked}</p>}
          {quest.lastNote && <p>{quest.lastNote}</p>}
        </div>
      )}
      <div className="quest-actions">
        <button
          type="button"
          onClick={() =>
            act(() => postQuestNote(quest.id, { author: 'human', text: 'Nudge', intent: 'nudge' }))
          }
        >
          Nudge
        </button>
        <button type="button" onClick={() => act(togglePark)}>
          {parked ? 'Unpark' : 'Park'}
        </button>
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
      {failedAction !== null && (
        <p className="quest-retry">
          That didn't go through. <button onClick={failedAction}>Retry</button>
        </p>
      )}
      {asking && <AskThread questId={quest.id} />}
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

export function WorldQuests() {
  const { id = '' } = useParams();
  const [name, setName] = useState('World');
  const [quests, setQuests] = useState<Quest[]>([]);
  const { subscribe } = useLiveEvents();
  const replaceQuest = useCallback(
    (quest: Quest) =>
      setQuests((current) => current.map((item) => (item.id === quest.id ? quest : item))),
    [],
  );
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
      .then((worlds) => setName(worlds.find((world) => world.id === id)?.name ?? 'World'))
      .catch(() => undefined);
    void listQuests({ world: id })
      .then(setQuests)
      .catch(() => setQuests([]));
  }, [id]);
  useEffect(() => {
    const unsubscribes = liveKinds.map((kind) => subscribe(kind, refreshQuest));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [refreshQuest, subscribe]);

  return (
    <section className="world-quests">
      <h1>{name}</h1>
      <div className="quest-list">
        {quests.map((quest) => (
          <QuestCard key={quest.id} quest={quest} onChange={replaceQuest} />
        ))}
      </div>
      {quests.length === 0 && <p className="pak-dim">No quests are stirring here.</p>}
    </section>
  );
}
