import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('הדף לא נמצא');
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <p className="font-mono text-sm text-[var(--kb-muted)]">404</p>
        <h1 className="text-2xl font-extrabold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">הדף לא נמצא</h1>
        <p className="text-[var(--kb-text2)]">הכתובת שהגעת אליה לא קיימת, או שהנושא הוסר.</p>
        <Link
          to="/"
          className="mt-2 inline-flex min-h-11 items-center rounded-[10px] bg-[var(--kb-accent)] px-5 text-sm font-semibold text-[var(--kb-on-accent)] no-underline hover:opacity-90"
        >
          חזרה לדף הבית
        </Link>
      </main>
    </>
  );
}
