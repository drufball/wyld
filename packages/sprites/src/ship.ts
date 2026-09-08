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

const structurallyEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object')
    return false;
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]))
    );
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(rightRecord, key) && structurallyEqual(leftRecord[key], rightRecord[key]),
    )
  );
};

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

type ShipSpecies = {
  before: readonly SpeciesData[];
  after: readonly SpeciesData[];
};

const displayName = (id: string) =>
  id.replace(/(^|-)([a-z])/g, (_match, separator: string, letter: string) =>
    separator ? ` ${letter.toUpperCase()}` : letter.toUpperCase(),
  );

export function describeShip(summary: ShipSummary, species: ShipSpecies): string {
  const before = new Map(species.before.map(({ id, name }) => [id, name]));
  const after = new Map(species.after.map(({ id, name }) => [id, name]));
  const name = (id: string, table: Map<string, string>) => table.get(id) ?? displayName(id);
  const lines = [
    ...summary.changed.map(
      ({ id, fields }) => `- **${name(id, after)}** (\`${id}\`) — ${fields.join(', ')}`,
    ),
    ...summary.added.map((id) => `- **${name(id, after)}** (\`${id}\`) — new species`),
    ...summary.removed.map((id) => `- **${name(id, before)}** (\`${id}\`) — removed`),
  ];
  return `Shipped by Dru from the Pak's creature workshop.\n\n${lines.join('\n')}`;
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

type ElementRange = { start: number; end: number; id: string };

const isJsonWhitespace = (character: string) =>
  character === ' ' || character === '\n' || character === '\r' || character === '\t';

const scanElements = (text: string): { elements: ElementRange[]; closingBracket: number } => {
  const elements: ElementRange[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  let closingBracket = -1;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      if (depth === 1 && start < 0) start = index;
    } else if (character === '{' || character === '[') {
      if (depth === 1 && start < 0) start = index;
      depth += 1;
    } else if (character === '}' || character === ']') {
      if (character === ']' && depth === 1) {
        if (start >= 0) {
          let end = index;
          while (isJsonWhitespace(text[end - 1]!)) end -= 1;
          const value = JSON.parse(text.slice(start, end)) as { id: string };
          elements.push({ start, end, id: value.id });
          start = -1;
        }
        closingBracket = index;
      }
      depth -= 1;
    } else if (character === ',' && depth === 1 && start >= 0) {
      const value = JSON.parse(text.slice(start, index)) as { id: string };
      elements.push({ start, end: index, id: value.id });
      start = -1;
    } else if (!isJsonWhitespace(character) && depth === 1 && start < 0) start = index;
  }
  if (closingBracket < 0) throw new Error('Species file is not a JSON array');
  return { elements, closingBracket };
};

const mergeValue = (original: unknown, next: unknown): unknown => {
  if (structurallyEqual(original, next)) return original;
  if (
    original === null ||
    next === null ||
    typeof original !== 'object' ||
    typeof next !== 'object' ||
    Array.isArray(original) ||
    Array.isArray(next)
  )
    return next;

  const merged = { ...(original as Record<string, unknown>) };
  const desired = next as Record<string, unknown>;
  for (const key of Object.keys(merged)) if (!(key in desired)) delete merged[key];
  for (const [key, value] of Object.entries(desired)) merged[key] = mergeValue(merged[key], value);
  return merged;
};

const indentValue = (value: unknown, indentation: string) =>
  JSON.stringify(value, null, 2).replaceAll('\n', `\n${indentation}`);

export function serialiseSpecies(originalText: string, species: readonly SpeciesData[]): string {
  Species.array().parse(species);
  const original = Species.array().parse(JSON.parse(originalText));
  const desired = new Map(species.map((value) => [value.id, value]));
  const originalById = new Map(original.map((value) => [value.id, value]));
  const { elements } = scanElements(originalText);
  const edits: { start: number; end: number; text: string }[] = [];

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index]!;
    const next = desired.get(element.id);
    if (next && !structurallyEqual(originalById.get(element.id), next)) {
      const lineStart = originalText.lastIndexOf('\n', element.start - 1) + 1;
      const indentation = originalText.slice(lineStart, element.start);
      edits.push({
        start: element.start,
        end: element.end,
        text: indentValue(mergeValue(originalById.get(element.id), ordered(next)), indentation),
      });
    }
  }

  for (let index = 0; index < elements.length; index += 1) {
    if (desired.has(elements[index]!.id)) continue;
    const first = index;
    while (index + 1 < elements.length && !desired.has(elements[index + 1]!.id)) index += 1;
    const after = elements[index + 1];
    if (after) edits.push({ start: elements[first]!.start, end: after.start, text: '' });
    else if (first > 0) {
      const comma = originalText.indexOf(',', elements[first - 1]!.end);
      edits.push({ start: comma, end: elements[index]!.end, text: '' });
    } else edits.push({ start: elements[first]!.start, end: elements[index]!.end, text: '' });
  }

  let result = originalText;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);

  const newSpecies = species.filter(({ id }) => !originalById.has(id));
  for (const value of newSpecies) {
    const scanned = scanElements(result);
    const indentation = scanned.elements.length
      ? result.slice(
          result.lastIndexOf('\n', scanned.elements[0]!.start - 1) + 1,
          scanned.elements[0]!.start,
        )
      : '  ';
    const insertionPoint = scanned.elements.at(-1)?.end ?? scanned.closingBracket;
    const prefix = scanned.elements.length ? ',' : '';
    result =
      result.slice(0, insertionPoint) +
      `${prefix}\n${indentation}${indentValue(ordered(value), indentation)}` +
      result.slice(insertionPoint);
  }
  return result;
}
