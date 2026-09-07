import { speciesById, type Temperament } from '../creatures/species.js';
import type { Phase } from '../world/time.js';
import { stubTitle, type Notebook, type Position, type Stub } from './notebook.js';

const TRACKS_RANGE = 6;
const CALL_RANGE = 25;
const IDENTIFY_RANGE = 40;
const IDENTIFY_SECONDS = 1.5;
const TEMPERAMENT_SECONDS = 20;
const SIGHTING_COOLDOWN_SECONDS = 30;

type ObservedCreature = {
  id: string;
  speciesId: string;
  region: string | null;
  position: Position;
  distance: number;
  moving: boolean;
  inView: boolean;
  wild: boolean;
  temperament: Temperament;
};
type ObserveFrame = {
  day: number;
  phase: Phase;
  region: string | null;
  playerPosition: Position;
  tracks: readonly { speciesId: string; regionId?: string; x: number; z: number }[];
  creatures: readonly ObservedCreature[];
};
type Discovery = {
  speciesId: string;
  slot: 'tracks' | 'call' | 'identified' | 'temperament' | 'move';
  title: string;
  hint: string;
  merged: number;
};
type Timer = { identify: number; temperament: number; sightingCooldown: number };

const numberWords = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
const evidenceDiscovery = (
  speciesId: string,
  slot: 'tracks' | 'call',
  region: string | null,
  day: number,
): Discovery => {
  const definition = speciesById(speciesId)!;
  const stub: Stub = {
    id: `${speciesId}:${slot}`,
    speciesId,
    slot,
    region,
    day,
    hint: definition.hints[slot],
  };
  return { speciesId, slot, title: stubTitle(stub), hint: stub.hint, merged: 0 };
};

const createObserver = ({ notebook }: { notebook: Notebook }) => {
  const timers = new Map<string, Timer>();
  let frameCreatures: readonly ObservedCreature[] = [];
  const timerFor = (id: string): Timer => {
    let timer = timers.get(id);
    if (!timer) {
      timer = { identify: 0, temperament: 0, sightingCooldown: 0 };
      timers.set(id, timer);
    }
    return timer;
  };
  const update = (dtSeconds: number, frame: ObserveFrame): Discovery[] => {
    frameCreatures = frame.creatures;
    const discoveries: Discovery[] = [];
    const live = new Set(frame.creatures.map(({ id }) => id));
    for (const id of timers.keys()) if (!live.has(id)) timers.delete(id);

    for (const track of frame.tracks) {
      if (
        Math.hypot(track.x - frame.playerPosition.x, track.z - frame.playerPosition.z) <=
        TRACKS_RANGE
      ) {
        const result = notebook.recordTracks(track.speciesId, {
          region: track.regionId ?? frame.region,
          day: frame.day,
        });
        if (result.recorded)
          discoveries.push(
            evidenceDiscovery(track.speciesId, 'tracks', track.regionId ?? frame.region, frame.day),
          );
      }
    }

    for (const creature of frame.creatures) {
      const timer = timerFor(creature.id);
      timer.sightingCooldown = Math.max(0, timer.sightingCooldown - dtSeconds);
      const observable = creature.wild && creature.inView && creature.distance <= IDENTIFY_RANGE;
      if (observable) {
        timer.identify += dtSeconds;
        if (timer.identify >= IDENTIFY_SECONDS) {
          const observation = {
            region: creature.region,
            phase: frame.phase,
            position: creature.position,
            day: frame.day,
          };
          if (notebook.page(creature.speciesId) === null) {
            const result = notebook.identify(creature.speciesId, observation);
            if (result.identified) {
              const definition = speciesById(creature.speciesId)!;
              const attachment =
                result.merged === 0
                  ? ''
                  : ` ${numberWords[result.merged] ?? String(result.merged)} earlier ${
                      result.merged === 1 ? 'note' : 'notes'
                    } attached.`;
              discoveries.push({
                speciesId: creature.speciesId,
                slot: 'identified',
                title: `Identified: ${definition.name}.${attachment}`,
                hint: definition.hints.identified,
                merged: result.merged,
              });
            }
            timer.sightingCooldown = SIGHTING_COOLDOWN_SECONDS;
          } else if (timer.sightingCooldown === 0) {
            notebook.recordSighting(creature.speciesId, observation);
            timer.sightingCooldown = SIGHTING_COOLDOWN_SECONDS;
          }
          timer.identify = 0;
        }
      }
      if (observable && creature.moving) {
        timer.temperament += dtSeconds;
        if (timer.temperament >= TEMPERAMENT_SECONDS) {
          if (notebook.recordTemperament(creature.speciesId, creature.temperament)) {
            const definition = speciesById(creature.speciesId)!;
            discoveries.push({
              speciesId: creature.speciesId,
              slot: 'temperament',
              title: `Temperament: ${creature.temperament}`,
              hint: definition.hints.identified,
              merged: 0,
            });
          }
          timer.temperament = 0;
        }
      }
    }
    return discoveries;
  };
  return {
    update,
    onCreatureCalled(
      event: { species: string; position: Position },
      frame: ObserveFrame,
    ): Discovery[] {
      if (
        Math.hypot(
          event.position.x - frame.playerPosition.x,
          event.position.z - frame.playerPosition.z,
        ) > CALL_RANGE
      )
        return [];
      const result = notebook.recordCall(event.species, { region: frame.region, day: frame.day });
      return result.recorded
        ? [evidenceDiscovery(event.species, 'call', frame.region, frame.day)]
        : [];
    },
    onCreatureExecutedMove(event: {
      species: string;
      move: string;
      distance: number;
      inView: boolean;
    }): Discovery[] {
      if (!event.inView || event.distance > IDENTIFY_RANGE) return [];
      if (!notebook.recordMove(event.species, event.move)) return [];
      const definition = speciesById(event.species)!;
      return [
        {
          speciesId: event.species,
          slot: 'move',
          title: `Move noted: ${event.move}`,
          hint: definition.hints.identified,
          merged: 0,
        },
      ];
    },
    identifying(): { species: string | null; progress: number } {
      let closest: { species: string; progress: number } | null = null;
      for (const creature of frameCreatures) {
        const progress = Math.min(1, (timers.get(creature.id)?.identify ?? 0) / IDENTIFY_SECONDS);
        if (progress > (closest?.progress ?? 0))
          closest = { species: creature.speciesId, progress };
      }
      return closest ?? { species: null, progress: 0 };
    },
  };
};

export {
  CALL_RANGE,
  IDENTIFY_RANGE,
  IDENTIFY_SECONDS,
  TEMPERAMENT_SECONDS,
  TRACKS_RANGE,
  createObserver,
};
export type { Discovery, ObserveFrame, ObservedCreature };
