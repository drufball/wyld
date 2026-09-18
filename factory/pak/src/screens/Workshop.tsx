import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpriteFrame } from '@wyld/sprites';
import {
  summariseShip,
  type SpeciesData,
  type SpeciesDraft,
  type SpeciesLibrary,
} from '@wyld/sprites/workshop';
import { deleteSpeciesDraft, listSpecies, putSpeciesDraft, shipSpecies } from '../api/client.js';
import { SpeciesEditor } from '../components/SpeciesEditor.js';
import { SpriteCanvas } from '../components/SpriteCanvas.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';

function CreatureCard({
  item,
  selected,
  draft,
  onSelect,
}: {
  item: SpeciesData;
  selected: boolean;
  draft?: SpeciesDraft;
  onSelect: () => void;
}) {
  const [frame, setFrame] = useState<SpriteFrame>('idle');
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = () => {
    clearInterval(timer.current);
    setFrame('idle');
  };
  useEffect(() => stop, []);
  return (
    <li>
      <Button
        variant="outline"
        className={`h-full w-full flex-col p-2 ${draft?.state === 'deleted' ? 'line-through opacity-60' : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
        onPointerEnter={() => {
          let next = false;
          setFrame('walk0');
          timer.current = setInterval(() => {
            next = !next;
            setFrame(next ? 'walk1' : 'walk0');
          }, 400);
        }}
        onPointerLeave={stop}
      >
        <div className="flex h-32 items-center justify-center">
          <SpriteCanvas
            spec={item}
            facing="down"
            frame={frame}
            scale={4}
            label={`${item.name} sprite`}
          />
        </div>
        <strong>{item.name}</strong>
        <div className="flex flex-wrap justify-center gap-1">
          <Badge className="whitespace-nowrap">Tier {item.tier}</Badge>
          <Badge variant="outline">{item.rarity}</Badge>
          {draft && (
            <Badge>
              {draft.state === 'new' ? 'New' : draft.state === 'edited' ? 'Edited' : 'Deleted'}
            </Badge>
          )}
        </div>
      </Button>
    </li>
  );
}

export function Workshop() {
  const [library, setLibrary] = useState<SpeciesLibrary | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState('');
  const [editorRevision, setEditorRevision] = useState(0);
  const [shipping, setShipping] = useState(false);
  const [shipProblems, setShipProblems] = useState<string[]>([]);
  const [shipped, setShipped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void listSpecies()
      .then((x) => {
        setLibrary({ ...x, drafts: x.drafts ?? [], references: x.references ?? {} });
        setSelected(x.species[0]?.id ?? '');
      })
      .catch(() => setFailed(true));
  }, []);
  const effective = useMemo(() => {
    if (!library) return [];
    const map = new Map(library.species.map((x) => [x.id, x]));
    for (const d of library.drafts) if (d.data) map.set(d.speciesId, d.data);
    return [...map.values()];
  }, [library]);
  const summary = useMemo(
    () => (library ? summariseShip(library.species, library.drafts) : null),
    [library],
  );
  if (failed) return <p>The workshop couldn't read the creature data. Try again.</p>;
  if (!library) return <p>Opening the creature workshop…</p>;
  const spec = effective.find((x) => x.id === selected) ?? effective[0];
  if (!spec) return <p>No creatures found.</p>;
  const draft = library.drafts.find((x) => x.speciesId === spec.id);
  const setDraft = (saved: SpeciesDraft) =>
    setLibrary(
      (x) =>
        x && { ...x, drafts: [...x.drafts.filter((d) => d.speciesId !== saved.speciesId), saved] },
    );
  const save = (value: SpeciesData) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () =>
        void putSpeciesDraft({
          speciesId: value.id,
          state: draft?.state === 'new' ? 'new' : 'edited',
          data: value,
        }).then(setDraft),
      500,
    );
  };
  const discard = async () => {
    clearTimeout(timer.current);
    await deleteSpeciesDraft(spec.id);
    setLibrary((x) => x && { ...x, drafts: x.drafts.filter((d) => d.speciesId !== spec.id) });
    if (draft?.state === 'new') setSelected(library.species[0]?.id ?? '');
    else setEditorRevision((value) => value + 1);
  };
  const remove = async () => {
    if (draft?.state === 'new') {
      await discard();
      return;
    }
    setDraft(await putSpeciesDraft({ speciesId: spec.id, state: 'deleted', data: null }));
  };
  const copy = async () => {
    let id = `${spec.id}-copy`,
      suffix = 'copy';
    while (effective.some((x) => x.id === id)) {
      suffix += 'copy';
      id = `${spec.id}-${suffix}`;
    }
    const data = { ...structuredClone(spec), id, name: `${spec.name} copy` };
    setDraft(await putSpeciesDraft({ speciesId: id, state: 'new', data }));
    setSelected(id);
  };
  const rename = async (value: SpeciesData) => {
    clearTimeout(timer.current);
    const previousId = spec.id;
    await deleteSpeciesDraft(previousId);
    const saved = await putSpeciesDraft({ speciesId: value.id, state: 'new', data: value });
    setLibrary(
      (current) =>
        current && {
          ...current,
          drafts: [
            ...current.drafts.filter(
              (item) => item.speciesId !== previousId && item.speciesId !== saved.speciesId,
            ),
            saved,
          ],
        },
    );
    setSelected(value.id);
  };
  const ship = async () => {
    setShipping(true);
    setShipProblems([]);
    try {
      const result = await shipSpecies();
      if (!result.shipped) setShipProblems(result.problems);
      else {
        const fresh = await listSpecies();
        setLibrary({ ...fresh, drafts: fresh.drafts ?? [], references: fresh.references ?? {} });
        setShipped(true);
      }
    } catch (error) {
      setShipProblems([error instanceof Error ? error.message : 'The workshop could not ship.']);
    } finally {
      setShipping(false);
    }
  };
  const nameFor = (id: string) =>
    effective.find((item) => item.id === id)?.name ??
    library.species.find((item) => item.id === id)?.name ??
    id;
  const changeCount = summary
    ? summary.added.length + summary.removed.length + summary.changed.length
    : 0;
  return (
    <div className="space-y-4">
      <header>
        <h1>Workshop</h1>
        <p className="text-muted-foreground">Shape every creature in the living world.</p>
        <Button onClick={() => void copy()}>New species</Button>
      </header>
      {shipped ? (
        <section className="rounded-lg border border-primary/40 bg-card p-4">
          <strong>Shipped. It'll be in the next disc.</strong>
        </section>
      ) : changeCount > 0 && summary ? (
        <section className="rounded-lg border border-primary/40 bg-card p-4" aria-busy={shipping}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong>{changeCount} species changed</strong>
              <ul className="mt-2 text-sm text-muted-foreground">
                {summary.changed.map(({ id, fields }) => (
                  <li key={id}>
                    {nameFor(id)} — {fields.join(', ')}
                  </li>
                ))}
                {summary.added.map((id) => (
                  <li key={id}>{nameFor(id)} — new species</li>
                ))}
                {summary.removed.map((id) => (
                  <li key={id}>{nameFor(id)} — removed</li>
                ))}
              </ul>
            </div>
            <Button className="min-h-11" disabled={shipping} onClick={() => void ship()}>
              {shipping ? 'Shipping…' : 'Ship'}
            </Button>
          </div>
          {shipping && <p className="mt-2 text-sm">Running the game's own tests…</p>}
          {shipProblems.length > 0 && (
            <ul role="alert" className="mt-3 text-sm text-destructive">
              {shipProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <ul className="grid auto-rows-min grid-cols-2 gap-2 self-start">
          {effective.map((item) => {
            const d = library.drafts.find((x) => x.speciesId === item.id);
            return (
              <CreatureCard
                key={item.id}
                item={item}
                selected={item.id === spec.id}
                draft={d}
                onSelect={() => {
                  setSelected(item.id);
                  detailRef.current?.scrollIntoView({ block: 'start' });
                }}
              />
            );
          })}
        </ul>
        <div ref={detailRef} className="scroll-mt-4">
          <SpeciesEditor
            key={`${spec.id}:${editorRevision}`}
            spec={spec}
            regions={library.regions}
            all={effective}
            references={library.references[spec.id] ?? []}
            isNew={draft?.state === 'new'}
            onChange={save}
            onRename={(value) => void rename(value)}
            onDiscard={() => void discard()}
            onDelete={() => void remove()}
          />
        </div>
      </div>
    </div>
  );
}
