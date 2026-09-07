type InputState = { down: ReadonlySet<string>; pressed: ReadonlySet<string> };
type Tap = { clientX: number; clientY: number };
const applyKeyEvent = (state: InputState, code: string, down: boolean): InputState => {
  const held = new Set(state.down),
    pressed = new Set(state.pressed);
  if (down) {
    if (!held.has(code)) pressed.add(code);
    held.add(code);
  } else held.delete(code);
  return { down: held, pressed };
};
const consumeEdges = (state: InputState): InputState => ({ down: state.down, pressed: new Set() });
type Input = {
  isDown(code: string): boolean;
  wasPressed(code: string): boolean;
  taps(): readonly Tap[];
  endFrame(): void;
  dispose(): void;
};
const createInput = (canvas: HTMLCanvasElement, ignore = () => false): Input => {
  let keys: InputState = { down: new Set(), pressed: new Set() },
    queue: Tap[] = [];
  const editing = (t: EventTarget | null) =>
    t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
  const kd = (e: KeyboardEvent) => {
      if (!editing(e.target)) keys = applyKeyEvent(keys, e.code, true);
    },
    ku = (e: KeyboardEvent) => {
      keys = applyKeyEvent(keys, e.code, false);
    },
    pointer = (e: PointerEvent) => {
      if (!ignore()) queue.push({ clientX: e.clientX, clientY: e.clientY });
    };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  canvas.addEventListener('pointerdown', pointer, { passive: true });
  return {
    isDown: (c) => keys.down.has(c),
    wasPressed: (c) => keys.pressed.has(c),
    taps: () => {
      const r = queue;
      queue = [];
      return r;
    },
    endFrame: () => {
      keys = consumeEdges(keys);
    },
    dispose: () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      canvas.removeEventListener('pointerdown', pointer);
    },
  };
};
export { applyKeyEvent, consumeEdges, createInput };
export type { Input, InputState, Tap };
