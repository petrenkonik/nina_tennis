import React from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500',
  secondary:
    'bg-brand-100 text-brand-800 hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/60 focus-visible:ring-brand-400',
  ghost:
    'bg-transparent text-content hover:bg-surface-muted focus-visible:ring-content-muted',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
  outline:
    'border border-surface-border bg-transparent text-content hover:bg-surface-muted focus-visible:ring-content-muted',
};

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-md gap-1',
  md: 'px-4 py-2 text-sm rounded-lg gap-1.5',
  lg: 'px-5 py-3 text-base rounded-lg gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
