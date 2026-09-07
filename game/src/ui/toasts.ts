import type { Discovery } from '../guide/observe.js';

const TOAST_SECONDS = 4;
const MAX_TOASTS = 4;

const createToastStack = () => {
  const root = document.createElement('aside');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', 'Field guide discoveries');
  root.style.cssText =
    'position:fixed;z-index:6;top:14px;left:50%;transform:translateX(-50%);width:min(420px,calc(100vw - 32px));display:flex;flex-direction:column;gap:6px;pointer-events:none;font:13px/18px ui-monospace,monospace;color:#292b25';
  document.body.append(root);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const show = (discovery: Discovery): void => {
    const toast = document.createElement('section');
    toast.style.cssText =
      'box-sizing:border-box;padding:8px 12px;border:1px solid #777566;background:repeating-linear-gradient(0deg,#f4efd9f5 0,#f4efd9f5 21px,#cbc4a766 22px),linear-gradient(105deg,#fff9df,#e8dfc5);box-shadow:1px 2px 2px #0004;opacity:0' +
      (reducedMotion ? '' : ';transform:translateY(-7px);transition:opacity .18s,transform .18s');
    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.textContent = discovery.title;
    const hint = document.createElement('div');
    hint.style.cssText = 'font-style:italic;font-weight:400;color:#55564d';
    hint.textContent = discovery.hint;
    toast.append(title, hint);
    root.prepend(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'none';
    });
    const visibleToasts = root.querySelectorAll(':scope > section');
    for (let index = MAX_TOASTS; index < visibleToasts.length; index += 1)
      visibleToasts[index]?.remove();
    window.setTimeout(() => {
      toast.style.opacity = '0';
      if (!reducedMotion) toast.style.transform = 'translateY(-4px)';
      window.setTimeout(() => toast.remove(), reducedMotion ? 0 : 180);
    }, TOAST_SECONDS * 1000);
  };
  return { root, show };
};

export { MAX_TOASTS, TOAST_SECONDS, createToastStack };
