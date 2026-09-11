import type { Force } from './moves.js';

const THREAT_WINDOW_SECONDS = 6;
const IMPACT_SPIKE = 20;

type ThreatHit = { attacker: string; final: number; force: Force; at: number };
type ThreatCandidate = { id: string; distance: number };

const threatOf = (hits: readonly ThreatHit[], attacker: string, now: number): number =>
  hits.reduce((total, hit) => {
    const age = now - hit.at;
    if (hit.attacker !== attacker || age < 0 || age >= THREAT_WINDOW_SECONDS) return total;
    const initial = hit.final + (hit.force === 'Impact' ? IMPACT_SPIKE : 0);
    return total + initial * (1 - age / THREAT_WINDOW_SECONDS);
  }, 0);

const pruneHits = (hits: readonly ThreatHit[], now: number): ThreatHit[] =>
  hits.filter((hit) => now - hit.at < THREAT_WINDOW_SECONDS);

const pickTarget = (
  candidates: readonly ThreatCandidate[],
  hits: readonly ThreatHit[],
  now: number,
  reachable: (id: string) => boolean,
): string | null => {
  let bestThreat: ThreatCandidate | undefined;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = threatOf(hits, candidate.id, now);
    if (score <= 0 || !reachable(candidate.id)) continue;
    if (
      !bestThreat ||
      score - bestScore >= 1e-9 ||
      (Math.abs(score - bestScore) < 1e-9 && candidate.distance < bestThreat.distance)
    ) {
      bestThreat = candidate;
      bestScore = score;
    }
  }
  if (bestThreat) return bestThreat.id;

  let nearest: ThreatCandidate | undefined;
  for (const candidate of candidates)
    if (!nearest || candidate.distance < nearest.distance) nearest = candidate;
  return nearest?.id ?? null;
};

export { IMPACT_SPIKE, THREAT_WINDOW_SECONDS, pickTarget, pruneHits, threatOf };
export type { ThreatCandidate, ThreatHit };
