/** Variants: flat is a quiet surface; bevel is the raised retro tile. data-tone colours its top edge. */
import type { HTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

export const cardVariants = cva('rounded-[var(--radius)] bg-card text-card-foreground', {
  variants: {
    variant: {
      flat: 'border border-border',
      bevel:
        'border-[3px] border-bevel-light border-r-bevel-dark border-b-bevel-dark data-[tone=ok]:border-t-dracula-green data-[tone=warn]:border-t-dracula-yellow data-[tone=bad]:border-t-dracula-red data-[tone=accent]:border-t-dracula-pink',
    },
  },
  defaultVariants: { variant: 'flat' },
});
export interface CardProps extends HTMLAttributes<HTMLElement>, VariantProps<typeof cardVariants> {
  asChild?: boolean;
}
export function Card({ asChild = false, className, variant, ...props }: CardProps) {
  const Component = asChild ? Slot : 'section';
  return <Component className={cn(cardVariants({ variant }), className)} {...props} />;
}
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2 p-5', className)} {...props} />;
}
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'font-display text-[11px] uppercase leading-relaxed tracking-normal text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2 p-5 pt-0', className)} {...props} />;
}
