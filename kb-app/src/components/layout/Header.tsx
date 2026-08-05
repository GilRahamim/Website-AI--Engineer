import ThemeToggle from '../theme/ThemeToggle';

export default function Header() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--kb-border)] bg-[var(--kb-surface)] px-4 py-3 shadow-[var(--kb-shadow-sm)]">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xl">🧠</span>
        <div className="flex flex-col leading-tight">
          <strong className="text-[var(--kb-text)]">מסד ידע</strong>
          <span className="text-xs text-[var(--kb-muted)]">AI Engineer</span>
        </div>
      </div>
      <ThemeToggle />
    </header>
  );
}
