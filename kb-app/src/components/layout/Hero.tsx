interface HeroProps {
  topicCount: number;
  moduleCount: number;
  masteredCount: number;
}

export default function Hero({ topicCount, moduleCount, masteredCount }: HeroProps) {
  return (
    <section className="px-4 py-8 text-center">
      <h1 className="text-2xl font-extrabold text-[var(--kb-text)] sm:text-3xl">מסד ידע — AI Engineer</h1>
      <p className="mx-auto mt-2 max-w-prose text-[var(--kb-text2)]">
        אוסף נושאים מרוכז ללימוד הנדסת AI — אלגוריתמים, מושגים, ארכיטקטורות ועוד.
      </p>
      <div className="mx-auto mt-6 flex w-fit flex-wrap justify-center gap-4">
        <div className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] px-6 py-3 shadow-[var(--kb-shadow-sm)]">
          <div className="text-2xl font-bold text-[var(--kb-accent)]">{topicCount}</div>
          <div className="text-sm text-[var(--kb-muted)]">נושאים</div>
        </div>
        <div className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] px-6 py-3 shadow-[var(--kb-shadow-sm)]">
          <div className="text-2xl font-bold text-[var(--kb-accent)]">{moduleCount}</div>
          <div className="text-sm text-[var(--kb-muted)]">מודולים</div>
        </div>
        <div className="rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] px-6 py-3 shadow-[var(--kb-shadow-sm)]">
          <div className="text-2xl font-bold text-[var(--kb-accent)]">{masteredCount}</div>
          <div className="text-sm text-[var(--kb-muted)]">{`מתוך ${topicCount} נשלטו`}</div>
        </div>
      </div>
    </section>
  );
}
