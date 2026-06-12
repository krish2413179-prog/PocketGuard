import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-colors',
  {
    variants: {
      variant: {
        default:   'border-transparent bg-white/10 text-white/80',
        success:   'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
        danger:    'border-red-500/20 bg-red-500/10 text-red-400',
        warning:   'border-amber-500/20 bg-amber-500/10 text-amber-400',
        info:      'border-white/10 bg-white/6 text-white/60',
        outline:   'border-white/10 text-white/50 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
