const DEFAULT_STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;

type AccumulatorState = { accumulator: number };

const advance = (
  state: AccumulatorState,
  frameMs: number,
  stepMs: number,
): { steps: number; accumulator: number } => {
  const accumulator = state.accumulator + Math.min(Math.max(frameMs, 0), MAX_FRAME_MS);
  const steps = Math.floor(accumulator / stepMs);
  return { steps, accumulator: accumulator - steps * stepMs };
};

type LoopOptions = {
  update(dtSeconds: number): void;
  render(alpha: number): void;
  step?: number;
  manual?: boolean;
};

const createLoop = ({ update, render, step = DEFAULT_STEP_MS, manual = false }: LoopOptions) => {
  let accumulator = 0;
  let previousTime: number | undefined;
  let requestId: number | undefined;
  let stepCount = 0;

  const frame = (time: number): void => {
    const frameMs = previousTime === undefined ? 0 : time - previousTime;
    previousTime = time;
    const result = advance({ accumulator }, frameMs, step);
    accumulator = result.accumulator;
    for (let index = 0; index < result.steps; index += 1) {
      update(step / 1000);
      stepCount += 1;
    }
    render(accumulator / step);
    requestId = window.requestAnimationFrame(frame);
  };

  return {
    stepMs: step,
    start(): void {
      if (manual || requestId !== undefined) return;
      previousTime = undefined;
      requestId = window.requestAnimationFrame(frame);
    },
    stop(): void {
      if (requestId === undefined) return;
      window.cancelAnimationFrame(requestId);
      requestId = undefined;
      previousTime = undefined;
      accumulator = 0;
    },
    stepTo(targetFrame: number): number {
      if (targetFrame <= stepCount) return stepCount;
      while (stepCount < targetFrame) {
        update(step / 1000);
        stepCount += 1;
      }
      render(0);
      return stepCount;
    },
  };
};

const fixedStepFromQuery = (search: string): boolean => {
  const value = new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get(
    'fixedstep',
  );
  return value === '1';
};

export { MAX_FRAME_MS, advance, createLoop, fixedStepFromQuery };
export type { AccumulatorState, LoopOptions };
