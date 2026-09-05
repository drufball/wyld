import type { ComponentPropsWithoutRef } from 'react';
import './Panel.css';

type PanelProps = ComponentPropsWithoutRef<'section'>;

export function Panel({ children, className = '', ...props }: PanelProps) {
  return (
    <section className={`pak-panel ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}
