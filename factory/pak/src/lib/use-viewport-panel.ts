import { useLayoutEffect, useState } from 'react';

export function useViewportPanel(gap = 32): (node: HTMLElement | null) => void {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!node) return;
    const media = window.matchMedia?.('(min-width: 768px)');
    const measure = () => {
      const height =
        (media?.matches ?? window.innerWidth >= 768)
          ? `${Math.max(0, window.innerHeight - node.getBoundingClientRect().top - gap)}px`
          : '';
      if (node.style.height !== height) node.style.height = height;
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(document.body);
    const parent = node.parentElement;
    if (parent && parent !== document.body) observer?.observe(parent);
    window.addEventListener('resize', measure);
    media?.addEventListener('change', measure);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      media?.removeEventListener('change', measure);
    };
  }, [gap, node]);

  return setNode;
}
