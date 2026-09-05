import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadWhenSafe } from './refresh.js';

function focusTextarea(value = ''): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  document.body.append(textarea);
  textarea.focus();
  return textarea;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('reloadWhenSafe', () => {
  it('reloads immediately when nothing is focused', () => {
    const reload = vi.fn();

    reloadWhenSafe({ document, reload });

    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads immediately when a focused textarea is empty', () => {
    const reload = vi.fn();
    focusTextarea();

    reloadWhenSafe({ document, reload });

    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not reload while a focused textarea has text', () => {
    const reload = vi.fn();
    focusTextarea('unfinished thought');

    reloadWhenSafe({ document, reload });

    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once the textarea blurs', () => {
    const reload = vi.fn();
    const textarea = focusTextarea('unfinished thought');
    reloadWhenSafe({ document, reload });

    textarea.blur();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads once the document becomes visible again', () => {
    const reload = vi.fn();
    const textarea = focusTextarea('unfinished thought');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    reloadWhenSafe({ document, reload });
    textarea.value = '';

    document.dispatchEvent(new Event('visibilitychange'));
    expect(reload).not.toHaveBeenCalled();

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads at most once across several triggers', () => {
    const reload = vi.fn();
    const textarea = focusTextarea('unfinished thought');
    reloadWhenSafe({ document, reload });

    textarea.value = '';
    textarea.blur();
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(90_000);

    expect(reload).toHaveBeenCalledOnce();
  });
});
