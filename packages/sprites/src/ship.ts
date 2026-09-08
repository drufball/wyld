import { Species, SpeciesDraft, TEMPERAMENTS, type SpeciesData } from './species.js';

export type ShipSummary = {
  added: string[];
  removed: string[];
  changed: { id: string; fields: string[] }[];
};

const fieldOrder = [
  'id',
  'name',
  'rarity',
  'tier',
  'bodyPlan',
  'hide',
  'innate',
  'forces',
  'stats',
  'temperament',
  'habitat',
  'signatureMoves',
  'tracks',
  'hints',
  'call',
  'palette',
  'visual',
] as const;

const structurallyEqual = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

export function applyDrafts(
  file: readonly SpeciesData[],
  drafts: readonly SpeciesDraft[],
): SpeciesData[] {
  const byId = new Map(drafts.map((draft) => [draft.speciesId, draft]));
  const result = file.flatMap((species) => {
    const draft = byId.get(species.id);
    if (draft?.state === 'deleted') return [];
    return [draft?.data ?? species];
  });
  const existing = new Set(file.map(({ id }) => id));
  for (const draft of [...drafts].sort((a, b) => a.speciesId.localeCompare(b.speciesId))) {
    if (draft.state === 'new' && draft.data && !existing.has(draft.speciesId))
      result.push(draft.data);
  }
  return result;
}

export function summariseShip(
  file: readonly SpeciesData[],
  drafts: readonly SpeciesDraft[],
): ShipSummary {
  const originals = new Map(file.map((species) => [species.id, species]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: ShipSummary['changed'] = [];
  for (const draft of drafts) {
    if (draft.state === 'new') added.push(draft.speciesId);
    else if (draft.state === 'deleted') removed.push(draft.speciesId);
    else if (draft.data) {
      const original = originals.get(draft.speciesId);
      if (original) {
        const fields = fieldOrder
          .filter((field) => !structurallyEqual(original[field], draft.data![field]))
          .sort();
        changed.push({ id: draft.speciesId, fields });
      }
    }
  }
  added.sort();
  removed.sort();
  changed.sort((a, b) => a.id.localeCompare(b.id));
  return { added, removed, changed };
}

const displayName = (id: string, file: readonly SpeciesData[]) =>
  file.find((species) => species.id === id)?.name ??
  id.replace(/(^|-)([a-z])/g, (_match, separator: string, letter: string) =>
    separator ? ` ${letter.toUpperCase()}` : letter.toUpperCase(),
  );

export function describeShip(summary: ShipSummary, file: readonly SpeciesData[]): string {
  const lines = [
    ...summary.changed.map(
      ({ id, fields }) => `- **${displayName(id, file)}** (\`${id}\`) — ${fields.join(', ')}`,
    ),
    ...summary.added.map((id) => `- **${displayName(id, file)}** (\`${id}\`) — new species`),
    ...summary.removed.map((id) => `- **${displayName(id, file)}** (\`${id}\`) — removed`),
  ];
  return `${lines.join('\n')}\n\nShipped from the creature workshop.`;
}

export function shipTitle(summary: ShipSummary): string {
  const count = summary.added.length + summary.removed.length + summary.changed.length;
  return `Workshop: ${count} ${count === 1 ? 'species' : 'species'} changed`;
}

const ordered = (species: SpeciesData): Record<string, unknown> => ({
  id: species.id,
  name: species.name,
  rarity: species.rarity,
  tier: species.tier,
  bodyPlan: species.bodyPlan,
  hide: species.hide,
  innate: species.innate,
  forces: species.forces,
  stats: {
    vigor: species.stats.vigor,
    power: species.stats.power,
    speed: species.stats.speed,
    focus: species.stats.focus,
  },
  temperament: Object.fromEntries(
    TEMPERAMENTS.flatMap((name) =>
      species.temperament[name] === undefined ? [] : [[name, species.temperament[name]]],
    ),
  ),
  habitat: species.habitat.map(({ region, phases }) => ({ region, phases })),
  signatureMoves: species.signatureMoves.map(({ name, delivery, force, power, speed }) => ({
    name,
    delivery,
    force,
    power,
    speed,
  })),
  tracks: {
    kind: species.tracks.kind,
    ...(species.tracks.toes === undefined ? {} : { toes: species.tracks.toes }),
    ...(species.tracks.drag === undefined ? {} : { drag: species.tracks.drag }),
    ...(species.tracks.stride === undefined ? {} : { stride: species.tracks.stride }),
  },
  hints: {
    tracks: species.hints.tracks,
    call: species.hints.call,
    identified: species.hints.identified,
  },
  call: {
    waveform: species.call.waveform,
    notes: species.call.notes.map(({ freq, dur }) => ({ freq, dur })),
    ...(species.call.noise === undefined ? {} : { noise: species.call.noise }),
  },
  palette: {
    primary: species.palette.primary,
    secondary: species.palette.secondary,
    ...(species.palette.accent === undefined ? {} : { accent: species.palette.accent }),
  },
  visual: Object.fromEntries(Object.entries(species.visual).sort(([a], [b]) => a.localeCompare(b))),
});

export function serialiseSpecies(species: readonly SpeciesData[]): string {
  Species.array().parse(species);
  return `${JSON.stringify(species.map(ordered), null, 2)}\n`;
}
