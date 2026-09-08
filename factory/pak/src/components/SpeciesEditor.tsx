import { useEffect, useState } from 'react';
import {
  BODY_PLANS,
  FORCES,
  HIDE_TABLE,
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
  type SpriteFacing,
  type SpriteFrame,
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
  onRename: (value: SpeciesData) => void;
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
  onRename,
  onDiscard,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState(spec);
  const [facing, setFacing] = useState<SpriteFacing>('down');
  const [walking, setWalking] = useState(false);
  const [frame, setFrame] = useState<SpriteFrame>('idle');
  useEffect(() => {
    if (!isNew && spec.id !== draft.id) setDraft(spec);
  }, [draft.id, isNew, spec]);
  useEffect(() => {
    if (!walking) {
      setFrame('idle');
      return;
    }
    let next = false;
    setFrame('walk0');
    const timer = setInterval(() => {
      next = !next;
      setFrame(next ? 'walk1' : 'walk0');
    }, 400);
    return () => clearInterval(timer);
  }, [walking]);
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
    <section className="space-y-3">
      <Card variant="bevel">
        <CardContent className="pt-5">
          <div className="flex h-48 items-center justify-center">
            <SpriteCanvas
              spec={draft}
              facing={facing}
              frame={frame}
              scale={6}
              label={`${draft.name} detail sprite`}
            />
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {(['down', 'up', 'side'] as const).map((value) => (
              <Button
                key={value}
                variant={facing === value ? 'default' : 'outline'}
                aria-pressed={facing === value}
                onClick={() => setFacing(value)}
              >
                {value[0]!.toUpperCase() + value.slice(1)}
              </Button>
            ))}
            <Button
              variant={walking ? 'default' : 'outline'}
              aria-pressed={walking}
              onClick={() => setWalking(!walking)}
            >
              Walk
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{draft.name}</CardTitle>
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
          {isNew && (
            <label>
              Id
              <input
                aria-label="Id"
                className={inputClass}
                value={draft.id}
                onChange={(event) => {
                  const next = { ...draft, id: event.target.value };
                  setDraft(next);
                  onRename(next);
                }}
              />
            </label>
          )}
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
                    {stat}: {range.join('–')} band {band.join('–')}
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
            <h3 className="font-bold">Creature facts</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="font-medium">Hide</dt>
              <dd>
                Weak to {HIDE_TABLE[draft.hide].weak}; resists {HIDE_TABLE[draft.hide].resists}
              </dd>
              <dt className="font-medium">Deliveries</dt>
              <dd>{deliveriesFor(draft.bodyPlan).join(', ')}</dd>
              <dt className="font-medium">Habitats</dt>
              <dd>
                {draft.habitat
                  .map(
                    (habitat) =>
                      regions.find((region) => region.id === habitat.region)?.name ??
                      habitat.region,
                  )
                  .join(', ')}
              </dd>
            </dl>
            <div className="sr-only" aria-hidden="true">
              <p>
                {draft.hide} · Weak to {HIDE_TABLE[draft.hide].weak} · Resists{' '}
                {HIDE_TABLE[draft.hide].resists}
              </p>
              <p>{draft.bodyPlan}</p>
              <p>{deliveriesFor(draft.bodyPlan).join(' · ')}</p>
              <p>
                {Object.entries(draft.temperament)
                  .map(([key, value]) => `${key} ${value}`)
                  .join(' · ')}
              </p>
              {draft.habitat.map((habitat, index) => (
                <p key={index}>
                  {regions.find((region) => region.id === habitat.region)?.name ?? habitat.region} ·{' '}
                  {habitat.phases.join(', ')}
                </p>
              ))}
              {draft.signatureMoves.map((move, index) => (
                <p key={index}>
                  {move.name} · power {move.power} · speed {move.speed}
                </p>
              ))}
              <p>
                {draft.tracks.kind}
                {draft.tracks.toes === undefined ? '' : ` · toes ${draft.tracks.toes}`}
                {draft.tracks.drag === undefined ? '' : ` · drag ${draft.tracks.drag}`}
                {draft.tracks.stride === undefined ? '' : ` · stride ${draft.tracks.stride}`}
              </p>
              <p>
                {draft.call.waveform} · {draft.call.notes.length} notes
                {draft.call.noise === undefined ? '' : ` · noise ${draft.call.noise}`}
              </p>
              <p>Tracks: {draft.hints.tracks}</p>
              <p>Call: {draft.hints.call}</p>
              <p>Identified: {draft.hints.identified}</p>
              {Object.entries(draft.palette).map(([key, value]) => (
                <span key={key}>
                  {key} {value}{' '}
                </span>
              ))}
            </div>
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
                  aria-label={`${x} temperament`}
                  onChange={(e) => {
                    const temperament = { ...draft.temperament };
                    if (e.target.value === '') delete temperament[x];
                    else temperament[x] = Number(e.target.value);
                    update({ ...draft, temperament });
                  }}
                />
              </label>
            ))}
            <p>
              Weights sum to{' '}
              {Number(
                Object.values(draft.temperament)
                  .reduce((a, b) => a + (b ?? 0), 0)
                  .toFixed(3),
              )}
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
                  deliveriesFor(draft.bodyPlan).includes(m.delivery)
                    ? deliveriesFor(draft.bodyPlan)
                    : [...deliveriesFor(draft.bodyPlan), m.delivery],
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
                {(['power', 'speed'] as const).map((field) => (
                  <label key={field}>
                    {field}
                    <input
                      aria-label={`Move ${i + 1} ${field}`}
                      type="number"
                      className={inputClass}
                      value={m[field]}
                      onChange={(e) => {
                        const a = [...draft.signatureMoves];
                        a[i] = { ...m, [field]: Number(e.target.value) };
                        update({ ...draft, signatureMoves: a });
                      }}
                    />
                  </label>
                ))}
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
            <Button
              onClick={() =>
                update({
                  ...draft,
                  signatureMoves: [
                    ...draft.signatureMoves,
                    {
                      name: 'New move',
                      delivery: deliveriesFor(draft.bodyPlan)[0]!,
                      force: draft.forces[0] ?? 'Impact',
                      power: 1,
                      speed: 1,
                    },
                  ],
                })
              }
            >
              Add move
            </Button>
          </section>
          <section>
            <h3 className="font-bold">Tracks & call</h3>
            {select('Track kind', draft.tracks.kind, TRACK_KINDS, (v) =>
              update({
                ...draft,
                tracks: { ...draft.tracks, kind: v as typeof draft.tracks.kind },
              }),
            )}
            {(['toes', 'stride'] as const).map((field) => (
              <label key={field}>
                {field}
                <input
                  aria-label={`Track ${field}`}
                  type="number"
                  className={inputClass}
                  value={draft.tracks[field] ?? ''}
                  onChange={(e) => {
                    const tracks = { ...draft.tracks };
                    if (e.target.value === '') delete tracks[field];
                    else tracks[field] = Number(e.target.value);
                    update({ ...draft, tracks });
                  }}
                />
              </label>
            ))}
            <label>
              <input
                aria-label="Track drag"
                type="checkbox"
                checked={draft.tracks.drag ?? false}
                onChange={(e) =>
                  update({ ...draft, tracks: { ...draft.tracks, drag: e.target.checked } })
                }
              />
              drag
            </label>
            {select('Waveform', draft.call.waveform, WAVEFORMS, (v) =>
              update({
                ...draft,
                call: { ...draft.call, waveform: v as typeof draft.call.waveform },
              }),
            )}
            {draft.call.notes.map((note, index) => (
              <div key={index}>
                {(['freq', 'dur'] as const).map((field) => (
                  <label key={field}>
                    {field}
                    <input
                      aria-label={`Note ${index + 1} ${field}`}
                      type="number"
                      className={inputClass}
                      value={note[field]}
                      onChange={(e) => {
                        const notes = [...draft.call.notes];
                        notes[index] = { ...note, [field]: Number(e.target.value) };
                        update({ ...draft, call: { ...draft.call, notes } });
                      }}
                    />
                  </label>
                ))}
                <Button
                  onClick={() =>
                    update({
                      ...draft,
                      call: {
                        ...draft.call,
                        notes: draft.call.notes.filter((_, i) => i !== index),
                      },
                    })
                  }
                >
                  Remove note
                </Button>
              </div>
            ))}
            <Button
              onClick={() =>
                update({
                  ...draft,
                  call: { ...draft.call, notes: [...draft.call.notes, { freq: 440, dur: 0.2 }] },
                })
              }
            >
              Add note
            </Button>
            <label className="mt-2 block">
              noise
              <input
                aria-label="Call noise"
                type="number"
                step="0.1"
                className={inputClass}
                value={draft.call.noise ?? ''}
                onChange={(e) => {
                  const call = { ...draft.call };
                  if (e.target.value === '') delete call.noise;
                  else call.noise = Number(e.target.value);
                  update({ ...draft, call });
                }}
              />
            </label>
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
                  onChange={(e) => {
                    const palette = { ...draft.palette };
                    if (key === 'accent' && e.target.value === '') delete palette.accent;
                    else palette[key] = e.target.value;
                    update({ ...draft, palette });
                  }}
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
              <div>
                {problems.map((x) => (
                  <p key={x}>{x}</p>
                ))}
              </div>
            )}
          </div>
          <Button onClick={onDiscard}>Discard changes</Button>
          <Button disabled={!isNew && references.length > 0} onClick={onDelete}>
            Delete
          </Button>
          {!isNew && references.length > 0 && <p>Used by {references.join(', ')}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
