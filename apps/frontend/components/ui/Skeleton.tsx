import React from 'react';
import { cx } from './cx';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('animate-pulse rounded-md bg-surface-border/60', className)}
      {...props}
    />
  );
}
