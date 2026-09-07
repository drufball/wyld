import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useViewportPanel } from './use-viewport-panel.js';

function Panel({ gap }: { gap?: number }) {
  const ref = useViewportPanel(gap);
  return (
    <div data-testid="parent">
      <section ref={ref} data-testid="panel" />
    </div>
  );
}

function stubMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useViewportPanel', () => {
  it('does not set an inline height below md', () => {
    stubMedia(false);
    const view = render(<Panel />);

    expect(view.getByTestId('panel').style.height).toBe('');
  });

  it('sets the height to the viewport below the panel top and gap at md', () => {
    stubMedia(true);
    vi.stubGlobal('innerHeight', 720);
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 103,
    } as DOMRect);

    const view = render(<Panel gap={24} />);

    expect(view.getByTestId('panel').style.height).toBe('593px');
    rect.mockRestore();
  });

  it('observes the body and panel parent and disconnects on unmount', () => {
    stubMedia(true);
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        disconnect = disconnect;
      },
    );

    const view = render(<Panel />);
    const panel = view.getByTestId('panel');

    expect(observe).toHaveBeenCalledWith(document.body);
    expect(observe).toHaveBeenCalledWith(panel.parentElement);
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
