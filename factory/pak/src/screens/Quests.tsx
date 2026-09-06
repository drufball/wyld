import {
  type Chain,
  type Demo,
  type Event,
  type Quest,
  type QuestNote,
  type QuestStatus,
} from '@wyld/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getQuest,
  listDemos,
  listQuests,
  listWorlds,
  patchQuestStatus,
  postChain,
  postQuestNote,
} from '../api/client.js';
import { ChainList } from '../components/ChainList.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Textarea } from '../components/ui/textarea.js';
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
    <div className="mt-5 grid gap-3 border-t-2 border-bevel-dark pt-3">
      <form className="grid gap-2" onSubmit={submit}>
        <label htmlFor={`ask-${questId}`}>Ask about this quest</label>
        <span className="flex flex-wrap gap-2">
          <Textarea
            ref={askField}
            id={`ask-${questId}`}
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
      {failedText !== null && (
        <p className="m-0 text-muted-foreground">
          That didn't go through.{' '}
          <Button variant="ghost" type="button" onClick={() => send(failedText)}>
            Retry
          </Button>
        </p>
      )}
    </div>
  );
}

export function QuestCard({
  quest,
  worldName,
  onChange,
  demo,
}: {
  quest: Quest;
  worldName: string;
  onChange: (quest: Quest) => void;
  demo?: Demo;
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
  const tone =
    quest.status === 'demo'
      ? 'ok'
      : quest.status === 'building'
        ? 'accent'
        : quest.status === 'parked'
          ? 'warn'
          : undefined;
  const togglePark = () => {
    if (!parked) previousStatus.current = quest.status === 'idea' ? 'idea' : 'building';
    return patchQuestStatus(quest.id, parked ? previousStatus.current : 'parked');
  };

  return (
    <Card asChild variant="bevel" data-tone={tone}>
      <article className="quest-card grid min-w-0 gap-3 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-[1_1_240px]">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="m-0 wrap-anywhere text-xl leading-snug">{quest.title}</h2>
              <Badge variant="outline">{worldName}</Badge>
            </div>
            <p className="my-2 wrap-anywhere text-muted-foreground">{quest.pitch}</p>
          </div>
          <Badge variant="tone" data-tone={tone}>
            {quest.status}
          </Badge>
        </header>
        <div
          className="h-2.5 overflow-hidden bg-muted"
          role="progressbar"
          aria-label={`${quest.title} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(quest.progress * 100)}
        >
          <span
            className="block h-full bg-dracula-green transition-[width] duration-400 motion-reduce:transition-none"
            style={{ width: `${quest.progress * 100}%` }}
          />
        </div>
        {(quest.sinceYouLooked || (quest.lastNote && quest.lastNote.toLowerCase() !== 'nudge')) && (
          <div className="grid gap-2 border-l-2 border-l-primary bg-muted p-3 text-muted-foreground">
            {quest.sinceYouLooked && (
              <p className="m-0 wrap-anywhere whitespace-pre-wrap">{quest.sinceYouLooked}</p>
            )}
            {quest.lastNote && quest.lastNote.toLowerCase() !== 'nudge' && (
              <p className="m-0 wrap-anywhere whitespace-pre-wrap">{quest.lastNote}</p>
            )}
          </div>
        )}
        <div className="quest-actions flex flex-wrap gap-2">
          <Button
            variant="retro"
            type="button"
            onClick={() =>
              act(
                () => postQuestNote(quest.id, { author: 'human', text: 'Nudge', intent: 'nudge' }),
                acknowledgeNudge,
              )
            }
          >
            Nudge
          </Button>
          <Button variant="retro" type="button" onClick={() => act(togglePark)}>
            {parked ? 'Unpark' : 'Park'}
          </Button>
          {quest.status !== 'done' && !parked && (
            <Button
              variant="retro"
              type="button"
              onClick={() => act(() => patchQuestStatus(quest.id, 'done'))}
            >
              Done
            </Button>
          )}
          <Button
            variant="retro"
            type="button"
            aria-expanded={asking}
            onClick={() => setAsking((value) => !value)}
          >
            Ask
          </Button>
          {demo ? (
            <Button variant="retro" asChild>
              <Link to={`/demos/${encodeURIComponent(demo.id)}`}>
                {demo.kind === 'live' ? 'Try it' : 'Play'}
              </Link>
            </Button>
          ) : (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Button variant="retro" type="button" disabled>
                Demo
              </Button>{' '}
              <small>not yet</small>
            </span>
          )}
        </div>
        {nudged && (
          <p
            className="motion-safe:animate-[acknowledgement_3s_ease-out_forwards]"
            aria-live="polite"
          >
            Nudged. Fable's on it.
          </p>
        )}
        {failedAction !== null && (
          <p className="m-0 text-muted-foreground">
            That didn't go through.{' '}
            <Button variant="ghost" type="button" onClick={failedAction}>
              Retry
            </Button>
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
    </Card>
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
  const [demosByQuest, setDemosByQuest] = useState<Map<string, Demo>>(new Map());
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
  const refreshDemos = useCallback(() => {
    void listDemos()
      .then((demos) => {
        const next = new Map<string, Demo>();
        for (const demo of [...demos].sort((left, right) => left.id.localeCompare(right.id))) {
          if (demo.questId && !next.has(demo.questId)) next.set(demo.questId, demo);
        }
        setDemosByQuest(next);
      })
      .catch(() => setDemosByQuest(new Map()));
  }, []);

  useEffect(() => {
    void listWorlds()
      .then(setWorlds)
      .catch(() => setWorlds([]));
    void listQuests()
      .then(setQuests)
      .catch(() => setQuests([]));
    refreshDemos();
  }, [refreshDemos]);
  useEffect(() => {
    const unsubscribes = liveKinds.map((kind) => subscribe(kind, refreshQuest));
    unsubscribes.push(subscribe('planner.quest_updated', refreshDemos));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [refreshDemos, refreshQuest, subscribe]);

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
    <section className="grid max-w-[1100px] gap-5">
      <h1>Quests</h1>
      {selectedQuest ? (
        <div className="grid gap-5">
          <QuestCard
            quest={selectedQuest}
            worldName={worldNames.get(selectedQuest.worldId) ?? selectedQuest.worldId}
            onChange={replaceQuest}
            demo={demosByQuest.get(selectedQuest.id)}
          />
          <Button
            variant="retro"
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('quest');
              setSearchParams(next);
            }}
          >
            Show all quests
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3">
            <div className="flex flex-wrap items-center gap-2" aria-label="World filter">
              <strong className="min-w-16 font-display text-[10px] uppercase">World</strong>
              {[{ id: 'all', name: 'All' }, ...worlds].map((world) => (
                <Button
                  variant={selectedWorld === world.id ? 'retro' : 'outline'}
                  className="rounded-full"
                  key={world.id}
                  type="button"
                  aria-pressed={selectedWorld === world.id}
                  onClick={() => chooseWorld(world.id)}
                >
                  {world.name}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2" aria-label="Status filter">
              <strong className="min-w-16 font-display text-[10px] uppercase">Status</strong>
              {statusFilters.map((filter) => (
                <Button
                  variant={status === filter.id ? 'retro' : 'outline'}
                  className="rounded-full"
                  key={filter.id}
                  type="button"
                  aria-pressed={status === filter.id}
                  onClick={() => {
                    setStatus(filter.id);
                    setDoneExpanded(false);
                  }}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-5">
            {activeQuests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                worldName={worldNames.get(quest.worldId) ?? quest.worldId}
                onChange={replaceQuest}
                demo={demosByQuest.get(quest.id)}
              />
            ))}
            {doneQuests.length > 0 && (
              <section className="grid gap-5">
                <Button
                  variant="ghost"
                  className="justify-start border-b-2 border-b-bevel-light font-display text-[10px]"
                  type="button"
                  aria-expanded={doneExpanded}
                  onClick={() => setDoneExpanded((expanded) => !expanded)}
                >
                  Done ({doneQuests.length})
                </Button>
                {doneExpanded &&
                  doneQuests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      worldName={worldNames.get(quest.worldId) ?? quest.worldId}
                      onChange={replaceQuest}
                      demo={demosByQuest.get(quest.id)}
                    />
                  ))}
              </section>
            )}
          </div>
          {filtered.length === 0 && (
            <p className="text-muted-foreground">No quests match these filters.</p>
          )}
        </>
      )}
    </section>
  );
}
