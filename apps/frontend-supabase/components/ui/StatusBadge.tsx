import React from 'react';
import { cx } from './cx';
import { FaCheckCircle, FaClock, FaTimesCircle, FaCircle } from 'react-icons/fa';

export type MatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'canceled';

const CONFIG: Record<
  MatchStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  scheduled: {
    label: 'Запланирован',
    className: 'bg-surface-muted text-content-muted',
    icon: FaClock,
  },
  in_progress: {
    label: 'В игре',
    className: 'bg-live/10 text-live',
    icon: FaCircle,
  },
  finished: {
    label: 'Завершён',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: FaCheckCircle,
  },
  canceled: {
    label: 'Отменён',
    className: 'bg-surface-muted text-content-muted line-through',
    icon: FaTimesCircle,
  },
};

export function StatusBadge({
  status,
  className,
  withPulse = true,
}: {
  status: MatchStatus | string;
  className?: string;
  /** Пульсация для live-матча */
  withPulse?: boolean;
}) {
  const cfg = CONFIG[status as MatchStatus] ?? CONFIG.scheduled;
  const Icon = cfg.icon;
  const isLive = status === 'in_progress';
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        cfg.className,
        className,
      )}
    >
      <Icon className={cx('text-[0.7em]', isLive && withPulse && 'animate-pulse-dot')} />
      {cfg.label}
    </span>
  );
}
