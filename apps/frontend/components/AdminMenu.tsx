import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import React, { useState } from 'react';

const adminMenu = [
  { href: '/admin/tournaments', label: 'Турниры' },
  { href: '/admin/groups', label: 'Группы' },
  { href: '/admin/players', label: 'Участники' },
  { href: '/admin/clubs', label: 'Клубы' },
];

export default function AdminMenu({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function handleLogout() {
    await signOut({ redirect: false });
    router.replace('/login');
  }
  return (
    <>
      {/* Десктопное меню */}
      <nav className={`hidden md:flex gap-2 border-b mb-4 overflow-x-auto bg-white sticky top-0 z-40 items-center ${className}`}>
        {adminMenu.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 whitespace-nowrap text-sm font-medium border-b-2 transition-colors ${pathname === item.href ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
          >
            {item.label}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="ml-auto px-3 py-2 text-sm text-gray-500 hover:text-red-600 font-medium border-b-2 border-transparent"
        >
          Выйти
        </button>
      </nav>
      {/* Мобильное меню */}
      <div className="md:hidden sticky top-0 z-50 bg-white border-b mb-4">
        <div className="flex items-center justify-between h-16 px-4">
          <span className="font-bold text-lg">Админ</span>
          <button onClick={() => setOpen(!open)} className="p-2 focus:outline-none">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 px-4 pb-2">
            {adminMenu.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`py-2 text-sm font-medium border-b transition-colors ${pathname === item.href ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => { setOpen(false); handleLogout(); }}
              className="py-2 text-sm text-gray-500 hover:text-red-600 font-medium border-b border-transparent text-left"
            >
              Выйти
            </button>
          </nav>
        )}
      </div>
    </>
  );
} 