import type { PropsWithChildren } from 'react';
import './Panel.css';

type PanelProps = PropsWithChildren<{ className?: string }>;

export function Panel({ children, className = '' }: PanelProps) {
  return <section className={`pak-panel ${className}`.trim()}>{children}</section>;
}
