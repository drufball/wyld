import { useEffect, useRef, useState } from 'react';
import {
  BODY_PLAN_DELIVERIES,
  HIDE_TABLE,
  STAT_NAMES,
  TIER_BANDS,
  type Region,
  type SpeciesData,
  type SpriteFacing,
  type SpriteFrame,
} from '@wyld/sprites';
import { listSpecies } from '../api/client.js';
import { SpriteCanvas } from '../components/SpriteCanvas.js';
import { Badge } from '../components/ui/badge.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.js';

const descriptor = (value: Record<string, unknown>) =>
  Object.entries(value)
    .flatMap(([key, item]) =>
      key === 'notes' && Array.isArray(item)
        ? `${item.length} notes`
        : key === 'kind' || key === 'waveform'
          ? String(item)
          : item === undefined
            ? []
            : `${key} ${String(item)}`,
    )
    .join(' · ');
function CreatureCard({
  spec,
  selected,
  onSelect,
}: {
  spec: SpeciesData;
  selected: boolean;
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
      <button
        className={`min-h-11 w-full rounded border p-2 ${selected ? 'border-accent' : 'border-border'}`}
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
        <SpriteCanvas
          spec={spec}
          facing="down"
          frame={frame}
          scale={4}
          label={`${spec.name} sprite`}
          className="mx-auto"
        />
        <strong>{spec.name}</strong>
        <div className="flex justify-center gap-1">
          <Badge>Tier {spec.tier}</Badge>
          <Badge variant="outline">{spec.rarity}</Badge>
        </div>
      </button>
    </li>
  );
}
export function Workshop() {
  const [data, setData] = useState<{ species: SpeciesData[]; regions: Region[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(0);
  const [facing, setFacing] = useState<SpriteFacing>('down');
  const [walking, setWalking] = useState(false);
  const [frame, setFrame] = useState<SpriteFrame>('idle');
  useEffect(() => {
    void listSpecies()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
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
  if (failed) return <p>The workshop couldn't read the creature data. Try again.</p>;
  if (!data) return <p>Opening the creature workshop…</p>;
  const spec = data.species[selected];
  if (!spec) return <p>No creatures found.</p>;
  const hide = HIDE_TABLE[spec.hide];
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-lg">Creature Workshop</h1>
        <p className="text-muted-foreground">Review every creature in the living world.</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <ul className="grid grid-cols-2 gap-2">
          {data.species.map((item, index) => (
            <CreatureCard
              key={item.id}
              spec={item}
              selected={index === selected}
              onSelect={() => setSelected(index)}
            />
          ))}
        </ul>
        <div className="space-y-3">
          <Card variant="bevel">
            <CardContent className="pt-5">
              <SpriteCanvas
                spec={spec}
                facing={facing}
                frame={frame}
                scale={6}
                label={`${spec.name} detail sprite`}
                className="mx-auto"
              />
              <div className="flex flex-wrap justify-center gap-1">
                {(['down', 'up', 'side'] as const).map((value) => (
                  <button
                    className="min-h-11 border px-3"
                    aria-pressed={facing === value}
                    onClick={() => setFacing(value)}
                    key={value}
                  >
                    {value[0]!.toUpperCase() + value.slice(1)}
                  </button>
                ))}
                <button
                  className="min-h-11 border px-3"
                  aria-pressed={walking}
                  onClick={() => setWalking(!walking)}
                >
                  Walk
                </button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{spec.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <section>
                <h3 className="font-bold">Stats</h3>
                {STAT_NAMES.map((stat) => (
                  <p key={stat}>
                    {stat}: {spec.stats[stat].join('–')}{' '}
                    <span className="text-muted-foreground">
                      band {TIER_BANDS[spec.tier][stat].join('–')}
                    </span>
                  </p>
                ))}
              </section>
              <section>
                <h3 className="font-bold">Hide</h3>
                <p>
                  {spec.hide} · Weak to {hide.weak} · Resists {hide.resists}
                </p>
              </section>
              <section>
                <h3 className="font-bold">Body plan</h3>
                <p>{spec.bodyPlan}</p>
                <div className="flex flex-wrap gap-1">
                  {BODY_PLAN_DELIVERIES[spec.bodyPlan].map((x) => (
                    <Badge key={x}>{x}</Badge>
                  ))}
                  {spec.innate.map((x) => (
                    <Badge variant="outline" key={x}>
                      {x}
                    </Badge>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="font-bold">Temperament</h3>
                <p>
                  {Object.entries(spec.temperament)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(' · ')}
                </p>
              </section>
              <section>
                <h3 className="font-bold">Habitat</h3>
                {spec.habitat.map((h, i) => (
                  <p key={i}>
                    {data.regions.find((r) => r.id === h.region)?.name ?? h.region} ·{' '}
                    {h.phases.join(', ')}
                  </p>
                ))}
              </section>
              <section>
                <h3 className="font-bold">Signature moves</h3>
                {spec.signatureMoves.map((m) => (
                  <div key={m.name}>
                    {m.name} · power {m.power} · speed {m.speed} <Badge>{m.delivery}</Badge>{' '}
                    <Badge variant="outline">{m.force}</Badge>
                  </div>
                ))}
              </section>
              <section>
                <h3 className="font-bold">Tracks & call</h3>
                <p>{descriptor(spec.tracks)}</p>
                <p>{descriptor(spec.call)}</p>
              </section>
              <section>
                <h3 className="font-bold">Hints</h3>
                <p>Tracks: {spec.hints.tracks}</p>
                <p>Call: {spec.hints.call}</p>
                <p>Identified: {spec.hints.identified}</p>
              </section>
              <section>
                <h3 className="font-bold">Palette</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(spec.palette).map(([name, color]) => (
                    <span key={name}>
                      <i
                        className="mr-1 inline-block size-4 border"
                        style={{ backgroundColor: color }}
                      />
                      {name} {color}
                    </span>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
