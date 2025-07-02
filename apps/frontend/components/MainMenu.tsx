"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function MainMenu() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuth = !!session;
  const menu = [
    { href: '/', label: 'Главная', icon: '🏠' },
    { href: '/tournaments', label: 'Турниры', icon: '🎾' },
    { href: '/profile', label: 'Профиль', icon: '👤' },
    { href: '/admin', label: 'Админ', icon: '🛠️' },
  ];
  return (
    <>
      {/* Мобильное меню */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow flex justify-around items-center h-16 md:hidden">
        {menu.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center text-xs transition-colors ${pathname === item.href ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            <span className="text-2xl mb-1">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        {!isAuth && (
          <Link
            href="/login"
            className={`flex flex-col items-center text-xs transition-colors ${pathname === '/login' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            <span className="text-2xl mb-1">🔑</span>
            Вход
          </Link>
        )}
      </nav>
      {/* Десктопное меню */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-white border-b shadow justify-center items-center h-16">
        {menu.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center mx-4 text-sm transition-colors ${pathname === item.href ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            <span className="text-2xl mb-1">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        {!isAuth && (
          <Link
            href="/login"
            className={`flex flex-col items-center mx-4 text-sm transition-colors ${pathname === '/login' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            <span className="text-2xl mb-1">🔑</span>
            Вход
          </Link>
        )}
      </nav>
    </>
  );
} 