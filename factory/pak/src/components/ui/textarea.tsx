/** Shared 44px mono multiline control with Dracula border, ring, and caret. */
import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-11 w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 font-mono text-foreground caret-accent outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
