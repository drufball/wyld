const RELOAD_RETRY_INTERVAL_MS = 30_000;
const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'radio']);

function activeElementHasText(doc: Document): boolean {
  const activeElement = doc.activeElement;

  if (!(activeElement instanceof HTMLElement)) return false;

  if (activeElement.isContentEditable) {
    return (activeElement.textContent ?? '').length > 0;
  }

  if (activeElement instanceof HTMLTextAreaElement) {
    return activeElement.value.length > 0;
  }

  return (
    activeElement instanceof HTMLInputElement &&
    !NON_TEXT_INPUT_TYPES.has(activeElement.type) &&
    activeElement.value.length > 0
  );
}

export function isSafeToReload(doc: Document): boolean {
  return !activeElementHasText(doc);
}

interface ReloadWhenSafeOptions {
  document?: Document;
  reload?: () => void;
}

export function reloadWhenSafe(options: ReloadWhenSafeOptions = {}): void {
  const doc = options.document ?? document;
  const reload = options.reload ?? (() => window.location.reload());

  if (isSafeToReload(doc)) {
    reload();
    return;
  }

  let hasReloaded = false;

  const cleanup = () => {
    doc.removeEventListener('blur', retry, true);
    doc.removeEventListener('visibilitychange', retryWhenVisible);
    clearInterval(interval);
  };

  const retry = () => {
    if (hasReloaded || !isSafeToReload(doc)) return;

    hasReloaded = true;
    cleanup();
    reload();
  };

  const retryWhenVisible = () => {
    if (doc.visibilityState === 'visible') retry();
  };

  doc.addEventListener('blur', retry, true);
  doc.addEventListener('visibilitychange', retryWhenVisible);
  const interval = setInterval(retry, RELOAD_RETRY_INTERVAL_MS);
}
