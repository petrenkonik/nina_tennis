import Link from 'next/link';

/**
 * Кастомная страница 404. Без неё Next.js показывает дефолтную англоязычную
 * страницу без навигации. Рендерится для любого несуществующего URL.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="text-center max-w-md">
        <div className="text-7xl font-bold text-brand-500 mb-4">404</div>
        <h1 className="text-2xl font-bold text-content mb-2">Страница не найдена</h1>
        <p className="text-content-muted mb-8">
          Возможно, страница была удалена или ссылка указана неверно.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-semibold transition-colors"
          >
            На главную
          </Link>
          <Link
            href="/tournaments"
            className="bg-surface-muted hover:bg-surface-border text-content px-5 py-2.5 rounded font-semibold transition-colors"
          >
            Турниры
          </Link>
        </div>
      </div>
    </main>
  );
}
