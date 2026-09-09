type BlurReason = 'reduced-motion' | 'unsupported' | 'slow';

const createVignette = () => {
  const element = document.createElement('div');
  element.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse at center, transparent 55%, rgba(20,24,18,0.35) 100%)';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsBlur =
    typeof CSS !== 'undefined' &&
    (CSS.supports('backdrop-filter', 'blur(1px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
  let reason: BlurReason | undefined = reducedMotion
    ? 'reduced-motion'
    : supportsBlur
      ? undefined
      : 'unsupported';
  let blur: HTMLDivElement | null = null;
  const apply = () => {
    element.dataset.blur = reason ? 'off' : 'on';
    if (reason) element.dataset.blurReason = reason;
    else delete element.dataset.blurReason;
    if (!reason && !blur) {
      blur = document.createElement('div');
      blur.style.cssText =
        'position:absolute;inset:0;backdrop-filter:blur(1.5px);-webkit-backdrop-filter:blur(1.5px);mask-image:radial-gradient(ellipse at center, transparent 60%, black 100%);-webkit-mask-image:radial-gradient(ellipse at center, transparent 60%, black 100%)';
      element.append(blur);
    } else if (reason && blur) {
      blur.remove();
      blur = null;
    }
  };
  apply();
  document.body.append(element);
  return {
    element,
    refresh(perf: { samples: number; frameMsP95: number }) {
      if (!reason && perf.samples >= 60 && perf.frameMsP95 > 20) {
        reason = 'slow';
        apply();
      }
    },
    dispose() {
      element.remove();
    },
  };
};

export { createVignette };
