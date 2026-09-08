import { useEffect, useState } from 'react';
import {
  BODY_PLANS,
  FORCES,
  HIDES,
  INNATE,
  PHASES,
  RARITIES,
  STAT_NAMES,
  TEMPERAMENTS,
  TRACK_KINDS,
  WAVEFORMS,
  bandFor,
  deliveriesFor,
  validateHints,
  validateSpecies,
  type Region,
  type SpeciesData,
} from '@wyld/sprites';
import { SpriteCanvas } from './SpriteCanvas.js';
import { Button } from './ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js';

type Props = {
  spec: SpeciesData;
  regions: Region[];
  all: SpeciesData[];
  references: string[];
  isNew: boolean;
  onChange: (value: SpeciesData) => void;
  onDiscard: () => void;
  onDelete: () => void;
};
const inputClass = 'min-h-11 w-full rounded border bg-background px-2';
export function SpeciesEditor({
  spec,
  regions,
  all,
  references,
  isNew,
  onChange,
  onDiscard,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState(spec);
  useEffect(() => setDraft(spec), [spec]);
  const update = (next: SpeciesData) => {
    setDraft(next);
    onChange(next);
  };
  const hints = validateHints(
    [...all.filter((x) => x.id !== draft.id), draft],
    regions.map((r) => r.name),
  );
  const problems = [
    ...validateSpecies(
      [draft],
      regions.map((r) => r.id),
    ),
    ...hints,
  ];
  const select = (
    label: string,
    value: string | number,
    options: readonly (string | number)[],
    set: (v: string) => void,
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        className={inputClass}
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        {options.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="space-y-3">
      <Card variant="bevel">
        <CardContent className="pt-5">
          <div className="flex h-48 items-center justify-center">
            <SpriteCanvas
              spec={draft}
              facing="down"
              frame="idle"
              scale={6}
              label={`${draft.name} detail sprite`}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{problems.length ? `${problems.length} problems` : 'Ready to ship'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label>
            Name
            <input
              aria-label="Name"
              className={inputClass}
              value={draft.name}
              onChange={(e) => update({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {select('Rarity', draft.rarity, RARITIES, (v) =>
              update({ ...draft, rarity: v as SpeciesData['rarity'] }),
            )}
            {select('Tier', draft.tier, [1, 2, 3], (v) =>
              update({ ...draft, tier: Number(v) as 1 | 2 | 3 }),
            )}
            {select('Body plan', draft.bodyPlan, BODY_PLANS, (v) =>
              update({ ...draft, bodyPlan: v as SpeciesData['bodyPlan'] }),
            )}
            {select('Hide', draft.hide, HIDES, (v) =>
              update({ ...draft, hide: v as SpeciesData['hide'] }),
            )}
          </div>
          <section>
            <h3 className="font-bold">Stats</h3>
            {STAT_NAMES.map((stat) => {
              const band = bandFor(draft.tier, stat);
              const range = draft.stats[stat];
              const invalid = range[0] < band[0] || range[1] > band[1];
              return (
                <div key={stat}>
                  <span>
                    {stat} — band {band.join('–')}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((i) => (
                      <input
                        key={i}
                        aria-label={`${stat} ${i ? 'maximum' : 'minimum'}`}
                        aria-invalid={invalid}
                        type="number"
                        className={inputClass}
                        value={range[i]}
                        onChange={(e) => {
                          const pair = [...range] as [number, number];
                          pair[i] = Number(e.target.value);
                          update({ ...draft, stats: { ...draft.stats, [stat]: pair } });
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
          <section>
            <h3 className="font-bold">Innate</h3>
            {INNATE.map((x) => (
              <Button
                key={x}
                variant={draft.innate.includes(x) ? 'default' : 'outline'}
                onClick={() =>
                  update({
                    ...draft,
                    innate: draft.innate.includes(x)
                      ? draft.innate.filter((y) => y !== x)
                      : [...draft.innate, x],
                  })
                }
              >
                {x}
              </Button>
            ))}
          </section>
          <section>
            <h3 className="font-bold">Forces</h3>
            {FORCES.map((x) => (
              <Button
                key={x}
                variant={draft.forces.includes(x) ? 'default' : 'outline'}
                onClick={() =>
                  update({
                    ...draft,
                    forces: draft.forces.includes(x)
                      ? draft.forces.filter((y) => y !== x)
                      : [...draft.forces, x],
                  })
                }
              >
                {x}
              </Button>
            ))}
          </section>
          <section>
            <h3 className="font-bold">Temperament</h3>
            {TEMPERAMENTS.map((x) => (
              <label key={x}>
                {x}
                <input
                  type="number"
                  step="0.1"
                  className={inputClass}
                  value={draft.temperament[x] ?? ''}
                  onChange={(e) =>
                    update({
                      ...draft,
                      temperament: { ...draft.temperament, [x]: Number(e.target.value) },
                    })
                  }
                />
              </label>
            ))}
            <p>
              Weights sum to {Object.values(draft.temperament).reduce((a, b) => a + (b ?? 0), 0)}
            </p>
          </section>
          <section>
            <h3 className="font-bold">Habitat</h3>
            {draft.habitat.map((h, i) => (
              <div key={i} className="border p-2">
                {select(
                  `Habitat region ${i + 1}`,
                  h.region,
                  regions.map((r) => r.id),
                  (v) => {
                    const a = [...draft.habitat];
                    a[i] = { ...h, region: v };
                    update({ ...draft, habitat: a });
                  },
                )}
                {PHASES.map((p) => (
                  <Button
                    key={p}
                    variant={h.phases.includes(p) ? 'default' : 'outline'}
                    onClick={() => {
                      const a = [...draft.habitat];
                      a[i] = {
                        ...h,
                        phases: h.phases.includes(p)
                          ? h.phases.filter((x) => x !== p)
                          : [...h.phases, p],
                      };
                      update({ ...draft, habitat: a });
                    }}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  onClick={() =>
                    update({ ...draft, habitat: draft.habitat.filter((_, j) => j !== i) })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              onClick={() =>
                update({
                  ...draft,
                  habitat: [...draft.habitat, { region: regions[0]?.id ?? '', phases: ['Day'] }],
                })
              }
            >
              Add habitat
            </Button>
          </section>
          <section>
            <h3 className="font-bold">Signature moves</h3>
            {draft.signatureMoves.map((m, i) => (
              <div key={i} className="grid gap-1 border p-2">
                <input
                  aria-label={`Move ${i + 1} name`}
                  className={inputClass}
                  value={m.name}
                  onChange={(e) => {
                    const a = [...draft.signatureMoves];
                    a[i] = { ...m, name: e.target.value };
                    update({ ...draft, signatureMoves: a });
                  }}
                />
                {select(
                  `Move ${i + 1} delivery`,
                  m.delivery,
                  deliveriesFor(draft.bodyPlan),
                  (v) => {
                    const a = [...draft.signatureMoves];
                    a[i] = { ...m, delivery: v as typeof m.delivery };
                    update({ ...draft, signatureMoves: a });
                  },
                )}
                {select(`Move ${i + 1} force`, m.force, draft.forces, (v) => {
                  const a = [...draft.signatureMoves];
                  a[i] = { ...m, force: v as typeof m.force };
                  update({ ...draft, signatureMoves: a });
                })}
                <Button
                  onClick={() =>
                    update({
                      ...draft,
                      signatureMoves: draft.signatureMoves.filter((_, j) => j !== i),
                    })
                  }
                >
                  Remove move
                </Button>
              </div>
            ))}
          </section>
          <section>
            <h3 className="font-bold">Tracks & call</h3>
            {select('Track kind', draft.tracks.kind, TRACK_KINDS, (v) =>
              update({
                ...draft,
                tracks: { ...draft.tracks, kind: v as typeof draft.tracks.kind },
              }),
            )}
            {select('Waveform', draft.call.waveform, WAVEFORMS, (v) =>
              update({
                ...draft,
                call: { ...draft.call, waveform: v as typeof draft.call.waveform },
              }),
            )}
          </section>
          <section>
            <h3 className="font-bold">Hints</h3>
            {(['tracks', 'call', 'identified'] as const).map((field) => (
              <label key={field}>
                {field}
                <input
                  aria-label={`${field} hint`}
                  className={inputClass}
                  value={draft.hints[field]}
                  onChange={(e) =>
                    update({ ...draft, hints: { ...draft.hints, [field]: e.target.value } })
                  }
                />
                {hints
                  .filter((x) => x.includes(`.hints.${field}`))
                  .map((x) => (
                    <span className="text-destructive" key={x}>
                      {x.split(`.hints.${field} `)[1]}
                    </span>
                  ))}
              </label>
            ))}
          </section>
          <section>
            <h3 className="font-bold">Palette</h3>
            {(['primary', 'secondary', 'accent'] as const).map((key) => (
              <div key={key} className="flex">
                <input
                  aria-label={`${key} colour`}
                  type="color"
                  value={draft.palette[key] ?? '#000000'}
                  onChange={(e) =>
                    update({ ...draft, palette: { ...draft.palette, [key]: e.target.value } })
                  }
                />
                <input
                  aria-label={`${key} hex`}
                  className={inputClass}
                  value={draft.palette[key] ?? ''}
                  onChange={(e) =>
                    update({ ...draft, palette: { ...draft.palette, [key]: e.target.value } })
                  }
                />
              </div>
            ))}
          </section>
          <section>
            <h3 className="font-bold">Visual</h3>
            {Object.entries(draft.visual).map(([key, value]) => (
              <label key={key}>
                {key}
                <input
                  type="number"
                  className={inputClass}
                  value={value}
                  onChange={(e) =>
                    update({ ...draft, visual: { ...draft.visual, [key]: Number(e.target.value) } })
                  }
                />
              </label>
            ))}
          </section>
          <div role="status">
            <h3 className="font-bold">Problems</h3>
            {problems.length === 0 ? (
              <p>Ready to ship</p>
            ) : (
              <ul>
                {problems.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
          <Button onClick={onDiscard}>Discard changes</Button>
          <Button disabled={!isNew && references.length > 0} onClick={onDelete}>
            Delete
          </Button>
          {!isNew && references.length > 0 && <p>Used by {references.join(', ')}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
