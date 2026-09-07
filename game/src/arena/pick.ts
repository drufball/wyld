type ArenaPhase = 'pick-enemy' | 'pick-party' | 'fight';
type PickState = { phase: ArenaPhase; enemy: string | null; party: readonly string[] };
import { enemy, rosterMember } from './roster.js';
const createPick = (): PickState => ({ phase: 'pick-enemy', enemy: null, party: [] });
const chooseEnemy = (state: PickState, id: string): PickState =>
  enemy(id) ? { phase: 'pick-party', enemy: id, party: [] } : state;
const toggleMember = (state: PickState, id: string): PickState => {
  if (!rosterMember(id)) return state;
  if (state.party.includes(id)) return { ...state, party: state.party.filter((x) => x !== id) };
  return state.party.length < 3 ? { ...state, party: [...state.party, id] } : state;
};
const canFight = (state: PickState): boolean =>
  state.phase === 'pick-party' && state.party.length === 3;
const startFight = (state: PickState): PickState =>
  canFight(state) ? { ...state, phase: 'fight' } : state;
const backToEnemies = (state: PickState): PickState => {
  void state;
  return createPick();
};
export { backToEnemies, canFight, chooseEnemy, createPick, startFight, toggleMember };
export type { ArenaPhase, PickState };
