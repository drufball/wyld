import type * as THREE from 'three';

type CreatureState = 'idle' | 'locomotion' | 'execute';
type BodyPlanSpec = {
  palette: { primary: string; secondary: string; accent?: string };
  visual: Record<string, number> & { length: number; height: number };
};
type CreatureModel = {
  group: THREE.Group;
  animate(t: number, state: CreatureState, waterDepth?: number): void;
  dispose(): void;
};
type BodyPlanBuilder = (spec: BodyPlanSpec) => CreatureModel;

export type { BodyPlanBuilder, BodyPlanSpec, CreatureModel, CreatureState };
