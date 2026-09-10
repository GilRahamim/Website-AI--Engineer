import { type FormEvent, useRef, useState, type ChangeEvent } from 'react';
import Header from '../components/layout/Header';
import { exportAllData, importAllData, type ExportPayload } from '../lib/db';
import { useUserDataStore } from '../store/userDataStore';
import { useAuthStore } from '../store/authStore';
import { useSyncStore } from '../store/syncStore';

const VALID_PROGRESS_STATUSES = new Set(['new', 'learning', 'mastered']);

function isValidExportPayload(value: unknown): value is ExportPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  if (payload.version !== 1) return false;
  if (typeof payload.data !== 'object' || payload.data === null) return false;
  const data = payload.data as Record<string, unknown>;

  const { progress, favorites, recents, notes, srsCards } = data;
  if (![progress, favorites, recents, notes, srsCards].every(Array.isArray)) return false;

  const progressRows = progress as unknown[];
  const favoriteRows = favorites as unknown[];
  const recentRows = recents as unknown[];
  const noteRows = notes as unknown[];
  const srsRows = srsCards as unknown[];

  const hasTopicId = (row: unknown): row is Record<string, unknown> =>
    typeof row === 'object' && row !== null && typeof (row as Record<string, unknown>).topicId === 'string';

  return (
    progressRows.every((row) =>
      hasTopicId(row) &&
      VALID_PROGRESS_STATUSES.has(row.status as string) &&
      typeof row.updatedAt === 'number'
    ) &&
    favoriteRows.every((row) => hasTopicId(row) && typeof row.createdAt === 'number') &&
    recentRows.every((row) => hasTopicId(row) && typeof row.viewedAt === 'number') &&
    noteRows.every((row) =>
      hasTopicId(row) &&
      typeof row.text === 'string' &&
      typeof row.updatedAt === 'number'
    ) &&
    srsRows.every((row) =>
      hasTopicId(row) &&
      typeof row.ease === 'number' &&
      typeof row.intervalDays === 'number' &&
      typeof row.dueAt === 'number' &&
      typeof row.reps === 'number' &&
      typeof row.lapses === 'number' &&
      typeof row.updatedAt === 'number'
    )
  );
}

function backupFileName(exportedAt: string): string {
  // Local calendar date (getFullYear/getMonth/getDate, not the UTC
  // getters) — exportedAt is an ISO/UTC timestamp, but the filename should
  // read as "today" to whoever is looking at their own downloads folder.
  const date = new Date(exportedAt);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `kb-backup-${yyyy}-${mm}-${dd}.json`;
}

function formatLastSynced(lastSyncedAt: number | null): string {
  if (lastSyncedAt === null) return 'מעולם לא';
  const elapsedMs = Date.now() - lastSyncedAt;
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return 'הרגע';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

export default function Settings() {
  const email = useAuthStore((s) => s.email);
  const isSending = useAuthStore((s) => s.status === 'sending');
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const [emailInput, setEmailInput] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setMessage(null);
    const payload = await exportAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFileName(payload.exportedAt);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleSendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    await useAuthStore.getState().sendMagicLink(emailInput);
    const { status, errorMessage } = useAuthStore.getState();
    if (status === 'sent') {
      setMessage({ kind: 'success', text: `קישור נשלח ל-\u2066${emailInput}\u2069, בדוק את תיבת הדואר.` });
    } else if (status === 'error') {
      setMessage({ kind: 'error', text: errorMessage ?? 'שליחת הקישור נכשלה.' });
    }
  }

  async function handleSignOut() {
    setMessage(null);
    await useAuthStore.getState().signOut();
  }

  async function handleSyncNow() {
    await useSyncStore.getState().syncNow();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    setMessage(null);
    const file = event.target.files?.[0];
    // Reset so re-selecting the same filename after a rejected import still
    // fires onChange.
    event.target.value = '';
    if (!file) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setMessage({ kind: 'error', text: 'קובץ לא תקין.' });
      return;
    }

    if (!isValidExportPayload(parsed)) {
      setMessage({ kind: 'error', text: 'קובץ לא תקין.' });
      return;
    }

    const confirmed = window.confirm('הפעולה תחליף את כל הנתונים המקומיים הקיימים. להמשיך?');
    if (!confirmed) return;

    const ok = await importAllData(parsed.data);
    if (!ok) {
      setMessage({ kind: 'error', text: 'הייבוא נכשל.' });
      return;
    }
    await useUserDataStore.getState().loadUserData();
    setMessage({ kind: 'success', text: 'הנתונים יובאו בהצלחה.' });
  }

  return (
    <>
      <Header />
      <main className="flex flex-col gap-8 p-4">
        <h1 className="text-xl font-bold text-[var(--kb-text)]">הגדרות</h1>

        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className="text-sm text-[var(--kb-text)]">
            {message.text}
          </p>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-[var(--kb-text)]">חשבון</h2>
          {email ? (
            <>
              <p className="text-sm text-[var(--kb-text)]">{`מחובר כ: \u2066${email}\u2069`}</p>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
              >
                התנתק
              </button>
              <p className="text-sm text-[var(--kb-muted)]">{`מסונכרן לאחרונה: ${formatLastSynced(lastSyncedAt)}`}</p>
              <button
                type="button"
                onClick={handleSyncNow}
                className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
              >
                סנכרן עכשיו
              </button>
            </>
          ) : (
            <form onSubmit={handleSendMagicLink} className="flex flex-col gap-2">
              <p className="text-sm text-[var(--kb-muted)]">התחבר כדי לסנכרן נתונים בין מכשירים.</p>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface)] px-3">
                <span className="sr-only">כתובת אימייל</span>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent py-2 text-[var(--kb-text)] outline-none placeholder:text-[var(--kb-muted)]"
                />
              </label>
              <button
                type="submit"
                disabled={isSending}
                className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)] disabled:opacity-50"
              >
                שלח קישור התחברות
              </button>
            </form>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-[var(--kb-text)]">ייצוא נתונים</h2>
          <p className="text-sm text-[var(--kb-muted)]">
            שמור קובץ גיבוי של כל הנתונים האישיים שלך — התקדמות, מועדפים, הערות וכרטיסיות.
          </p>
          <button
            type="button"
            onClick={handleExport}
            className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
          >
            ייצא את הנתונים שלי
          </button>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-[var(--kb-text)]">ייבוא נתונים</h2>
          <p className="text-sm text-[var(--kb-muted)]">
            שחזר נתונים מקובץ גיבוי. הפעולה תחליף את כל הנתונים המקומיים הקיימים.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileSelected}
            aria-label="בחר קובץ גיבוי לייבוא"
            className="sr-only"
          />
          <button
            type="button"
            onClick={handleImportClick}
            className="min-h-11 w-fit rounded-md border border-[var(--kb-border)] px-4 text-sm text-[var(--kb-text)] hover:bg-[var(--kb-surface2)]"
          >
            ייבוא נתונים
          </button>
        </section>
      </main>
    </>
  );
}
