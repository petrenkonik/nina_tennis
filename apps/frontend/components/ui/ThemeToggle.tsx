"use client";

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { FaSun, FaMoon } from 'react-icons/fa';
import { cx } from './cx';

/** Переключатель светлой/тёмной темы. Монтируется только на клиенте (next-themes). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = theme === 'system' ? resolvedTheme : theme;
  const isDark = current === 'dark';

  // До гидратации не показываем конкретную иконку, чтобы избежать рассинхрона
  if (!mounted) {
    return (
      <button
        aria-label="Переключить тему"
        className={cx(
          'inline-flex items-center justify-center w-8 h-8 rounded-md text-content-muted',
          className,
        )}
      >
        <span className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <button
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cx(
        'inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors',
        'text-content-muted hover:text-content hover:bg-surface-muted',
        className,
      )}
    >
      {isDark ? <FaSun className="w-3.5 h-3.5" /> : <FaMoon className="w-3.5 h-3.5" />}
    </button>
  );
}
