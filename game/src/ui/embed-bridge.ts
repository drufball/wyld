export function installEmbedBridge(): () => void {
  const listener = (event: MessageEvent) => {
    const data = event.data as { type?: unknown; id?: unknown } | null;
    if (
      typeof data !== 'object' ||
      data === null ||
      data.type !== 'wyld:demo:capture' ||
      !event.source
    )
      return;
    let screenshot: string | null = null;
    let state: unknown = null;
    try {
      screenshot = window.__wyld.screenshot();
    } catch {
      // A failed screenshot must not prevent the state capture.
    }
    try {
      state = window.__wyld.getState();
    } catch {
      // Report the screenshot even if state serialization fails.
    }
    (event.source as Window).postMessage(
      { type: 'wyld:demo:capture:result', id: data.id, screenshot, state },
      '*',
    );
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
