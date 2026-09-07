type Delivery = 'Strike' | 'Lunge' | 'Bolt' | 'Arc' | 'Sweep';
type Force = 'Impact' | 'Cut' | 'Heat' | 'Surge';
type Modifier = 'Follow-through' | 'Lingering' | 'Quickened' | 'Reaching' | 'Heavy';
type Move = {
  id: string;
  name: string;
  delivery: Delivery;
  force: Force;
  power: number;
  speed: number;
  cooldownMult: number;
  rangeMult: number;
  modifiers: Modifier[];
  familiarity: number;
  upgradeLevel: number;
};

export type { Delivery, Force, Modifier, Move };
