import type { ComponentPropsWithoutRef } from 'react';
import { Card } from './ui/card.js';

type PanelProps = ComponentPropsWithoutRef<'section'>;

export function Panel({ children, className = '', ...props }: PanelProps) {
  return (
    <Card variant="bevel" className={`p-5 ${className}`.trim()} {...props}>
      {children}
    </Card>
  );
}
