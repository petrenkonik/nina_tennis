"use client";
import AdminMenu from "components/AdminMenu";
import MainMenu from "components/MainMenu";
import Link from 'next/link';

export default function AdminRootPage() {
  return (
    <main className="max-w-3xl mx-auto py-8 px-2 pb-24 relative">
      <AdminMenu className="hidden md:flex" />
      
      
      <h1 className="text-2xl font-bold mb-4">Админ-панель</h1>
      <div className="text-gray-500">Добро пожаловать в административную панель.</div>
      <nav className="mb-6">
        <Link href="/admin/players" className="block px-4 py-2 hover:bg-gray-100 rounded">Все игроки</Link>
      </nav>
    </main>
  );
} 