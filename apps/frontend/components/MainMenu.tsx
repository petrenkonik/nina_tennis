"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ThemeToggle } from 'components/ui/ThemeToggle';

export default function MainMenu() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAuth = !!session;
  const menu = [
    { href: '/', label: 'Главная', icon: '🏠' },
    { href: '/tournaments', label: 'Турниры', icon: '🎾' },
    { href: '/profile', label: 'Профиль', icon: '👤' },
    { href: '/admin', label: 'Админ', icon: '🛠️' },
  ];
  const linkClass = (active: boolean) =>
    `flex flex-col items-center text-xs transition-colors ${active ? 'text-brand-600 dark:text-brand-400 font-bold' : 'text-content-muted'}`;
  return (
    <>
      {/* Мобильное меню */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card border-t border-surface-border shadow flex justify-around items-center h-16 md:hidden">
        {menu.map(item => (
          <Link key={item.href} href={item.href} className={linkClass(pathname === item.href)}>
            <span className="text-2xl mb-1">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        {!isAuth && (
          <Link href="/login" className={linkClass(pathname === '/login')}>
            <span className="text-2xl mb-1">🔑</span>
            Вход
          </Link>
        )}
      </nav>
      {/* Десктопное меню */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-surface-card border-b border-surface-border shadow justify-center items-center h-16">
        {menu.map(item => (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center mx-4 text-sm transition-colors ${linkClass(pathname === item.href)}`}>
            <span className="text-2xl mb-1">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        {!isAuth && (
          <Link href="/login" className={`flex flex-col items-center mx-4 text-sm transition-colors ${linkClass(pathname === '/login')}`}>
            <span className="text-2xl mb-1">🔑</span>
            Вход
          </Link>
        )}
        <div className="absolute right-4">
          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
