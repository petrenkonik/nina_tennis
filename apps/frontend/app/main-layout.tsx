"use client";

import MainMenu from "components/MainMenu";

export default function MainLayout({
  children,
  header,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
}) {
  return (
    <main className="max-w-3xl mx-auto py-8 px-4 pb-24 md:pt-16">
      <h1 className="text-2xl font-bold mb-6">{header}</h1>
      
      {children}

      <MainMenu />
    </main>
  );
}