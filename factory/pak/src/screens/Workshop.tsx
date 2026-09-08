import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpeciesData, SpeciesDraft, SpeciesLibrary } from '@wyld/sprites';
import { deleteSpeciesDraft, listSpecies, putSpeciesDraft } from '../api/client.js';
import { SpeciesEditor } from '../components/SpeciesEditor.js';
import { SpriteCanvas } from '../components/SpriteCanvas.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';

export function Workshop() {
  const [library, setLibrary] = useState<SpeciesLibrary | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
    await deleteSpeciesDraft(spec.id);
    setLibrary((x) => x && { ...x, drafts: x.drafts.filter((d) => d.speciesId !== spec.id) });
    if (draft?.state === 'new') setSelected(library.species[0]?.id ?? '');
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
      n = 2;
    while (effective.some((x) => x.id === id)) {
      id = `${spec.id}-copy-${n++}`;
    }
    const data = { ...structuredClone(spec), id, name: `${spec.name} copy` };
    setDraft(await putSpeciesDraft({ speciesId: id, state: 'new', data }));
    setSelected(id);
  };
  return (
    <div className="space-y-4">
      <header>
        <h1>Workshop</h1>
        <p className="text-muted-foreground">Shape every creature in the living world.</p>
        <Button onClick={() => void copy()}>New species</Button>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <ul className="grid grid-cols-2 gap-2">
          {effective.map((item) => {
            const d = library.drafts.find((x) => x.speciesId === item.id);
            return (
              <li key={item.id}>
                <Button
                  variant="outline"
                  className={`h-full w-full min-h-44 flex-col ${d?.state === 'deleted' ? 'line-through opacity-60' : ''}`}
                  aria-current={item.id === spec.id ? 'true' : undefined}
                  onClick={() => setSelected(item.id)}
                >
                  <SpriteCanvas
                    spec={item}
                    facing="down"
                    frame="idle"
                    scale={4}
                    label={`${item.name} sprite`}
                  />
                  <strong>{item.name}</strong>
                  {d && (
                    <Badge>
                      {d.state === 'new' ? 'New' : d.state === 'edited' ? 'Edited' : 'Deleted'}
                    </Badge>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
        <SpeciesEditor
          key={spec.id}
          spec={spec}
          regions={library.regions}
          all={effective}
          references={library.references[spec.id] ?? []}
          isNew={draft?.state === 'new'}
          onChange={save}
          onDiscard={() => void discard()}
          onDelete={() => void remove()}
        />
      </div>
    </div>
  );
}
