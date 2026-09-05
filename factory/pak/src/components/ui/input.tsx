/** Shared 44px mono text control with Dracula border, ring, and caret. */
import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'min-h-11 w-full rounded-[var(--radius)] border border-input bg-background px-3 font-mono text-foreground caret-accent outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  );
}
