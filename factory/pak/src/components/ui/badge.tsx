/** Variants: default fill, outline, and data-tone-aware tone. Interactive uses must add min-h-11. */
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';
export const badgeVariants = cva(
  'inline-flex w-fit items-center rounded-[var(--radius)] px-2 py-1 font-display text-[9px] uppercase leading-relaxed',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        outline: 'border border-border text-foreground',
        tone: 'border border-muted-foreground text-muted-foreground data-[tone=ok]:border-dracula-green data-[tone=ok]:text-dracula-green data-[tone=warn]:border-dracula-yellow data-[tone=warn]:text-dracula-yellow data-[tone=bad]:border-dracula-red data-[tone=bad]:text-dracula-red data-[tone=accent]:border-dracula-pink data-[tone=accent]:text-dracula-pink',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);
export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
