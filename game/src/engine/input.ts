type InputState = {
  down: ReadonlySet<string>;
  pressed: ReadonlySet<string>;
};

type MouseState = { x: number; y: number; pointerLocked: boolean };

const applyKeyEvent = (state: InputState, code: string, down: boolean): InputState => {
  const held = new Set(state.down);
  const pressed = new Set(state.pressed);
  if (down) {
    if (!held.has(code)) pressed.add(code);
    held.add(code);
  } else {
    held.delete(code);
  }
  return { down: held, pressed };
};

const consumeEdges = (state: InputState): InputState => ({ down: state.down, pressed: new Set() });

const applyMouseMovement = (state: MouseState, x: number, y: number): MouseState =>
  state.pointerLocked ? { ...state, x: state.x + x, y: state.y + y } : state;

type Input = {
  isDown(code: string): boolean;
  wasPressed(code: string): boolean;
  mouseDelta(): { x: number; y: number };
  readonly pointerLocked: boolean;
  endFrame(): void;
  dispose(): void;
};

const createInput = (canvas: HTMLCanvasElement): Input => {
  let keys: InputState = { down: new Set(), pressed: new Set() };
  let mouse: MouseState = { x: 0, y: 0, pointerLocked: false };
  const editingText = (target: EventTarget | null): boolean => {
    const element = target instanceof HTMLElement ? target : document.activeElement;
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (!editingText(event.target)) keys = applyKeyEvent(keys, event.code, true);
  };
  const keyUp = (event: KeyboardEvent): void => {
    keys = applyKeyEvent(keys, event.code, false);
  };
  const move = (event: MouseEvent): void => {
    mouse = applyMouseMovement(mouse, event.movementX, event.movementY);
  };
  const lockChanged = (): void => {
    mouse = { ...mouse, pointerLocked: document.pointerLockElement === canvas };
  };
  const click = (): void => {
    const result: unknown = canvas.requestPointerLock();
    if (result instanceof Promise) void result.catch(() => undefined);
  };
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('mousemove', move);
  document.addEventListener('pointerlockchange', lockChanged);
  canvas.addEventListener('click', click);
  return {
    isDown: (code) => keys.down.has(code),
    wasPressed: (code) => keys.pressed.has(code),
    mouseDelta: () => {
      const result = { x: mouse.x, y: mouse.y };
      mouse = { ...mouse, x: 0, y: 0 };
      return result;
    },
    get pointerLocked() {
      return mouse.pointerLocked;
    },
    endFrame: () => {
      keys = consumeEdges(keys);
    },
    dispose: () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('mousemove', move);
      document.removeEventListener('pointerlockchange', lockChanged);
      canvas.removeEventListener('click', click);
    },
  };
};

export { applyKeyEvent, applyMouseMovement, consumeEdges, createInput };
export type { Input, InputState, MouseState };
