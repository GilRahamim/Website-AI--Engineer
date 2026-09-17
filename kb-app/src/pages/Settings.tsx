import { type FormEvent, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Download } from 'lucide-react';
import Header from '../components/layout/Header';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { exportAllData, importAllData, type ExportPayload } from '../lib/db';
import { isSupabaseConfigured } from '../lib/supabase';
import { getThemePreference, setThemePreference, type ThemePreference } from '../lib/theme';
import { getPathMode, setPathMode, type PathMode } from '../lib/pathMode';
import { usePageTitle } from '../hooks/usePageTitle';
import { useUserDataStore } from '../store/userDataStore';
import { useAuthStore } from '../store/authStore';
import { useSyncStore } from '../store/syncStore';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'בהירה' },
  { value: 'dark', label: 'כהה' },
  { value: 'system', label: 'לפי המערכת' },
];

const PATH_MODE_OPTIONS: { value: PathMode; label: string; description: string }[] = [
  { value: 'guided', label: 'מודרך', description: 'מסמן לך את הנושא הנוכחי בנתיב ואת מה שעוד לא הגעת אליו — בלי לחסום קפיצות קדימה.' },
  { value: 'free', label: 'חופשי', description: 'בלי הנחיה — עברו בין הנושאים בכל סדר שתרצו.' },
];

const SECTION_CLASS =
  'flex flex-col gap-2 rounded-2xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-4 shadow-[var(--kb-shadow-sm)]';

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
  usePageTitle('הגדרות');
  const email = useAuthStore((s) => s.email);
  const isSending = useAuthStore((s) => s.status === 'sending');
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const [emailInput, setEmailInput] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(getThemePreference);
  const [pathMode, setPathModeState] = useState<PathMode>(getPathMode);
  const syncAvailable = isSupabaseConfigured();
  const { canInstall, promptInstall } = useInstallPrompt();

  // The header toggle and the command palette also change the theme; keep
  // the radio group in step with whichever control was used last.
  useEffect(() => {
    function handleThemeChange() {
      setThemePreferenceState(getThemePreference());
    }
    window.addEventListener('kb-theme-change', handleThemeChange);
    return () => window.removeEventListener('kb-theme-change', handleThemeChange);
  }, []);

  function handleThemeChoice(preference: ThemePreference) {
    setThemePreference(preference);
  }

  function handlePathModeChoice(mode: PathMode) {
    setPathMode(mode);
    setPathModeState(mode);
  }

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
      <main className="mx-auto flex max-w-xl flex-col gap-5 p-4 sm:px-6">
        <h1 className="text-xl font-bold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">הגדרות</h1>

        {message && (
          <Alert
            variant={message.kind === 'error' ? 'destructive' : 'default'}
            role={message.kind === 'error' ? 'alert' : 'status'}
          >
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <section className={SECTION_CLASS}>
          <h2 className="font-semibold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">מראה</h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-[var(--kb-muted)]">ערכת נושא</legend>
            <ToggleGroup
              type="single"
              value={themePreference}
              onValueChange={(value) => value && handleThemeChoice(value as ThemePreference)}
              aria-label="ערכת נושא"
              className="w-fit rounded-[10px] bg-[var(--kb-surface2)] p-[3px]"
            >
              {THEME_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="min-h-10 rounded-lg px-4 text-sm data-[state=on]:bg-[var(--kb-surface)] data-[state=on]:font-semibold data-[state=on]:text-[var(--kb-accent)] data-[state=on]:shadow-[var(--kb-shadow-sm)]"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className="font-semibold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">נתיב למידה</h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-[var(--kb-muted)]">מצב הדרכה</legend>
            <ToggleGroup
              type="single"
              value={pathMode}
              onValueChange={(value) => value && handlePathModeChoice(value as PathMode)}
              aria-label="מצב הדרכה בנתיב הלמידה"
              className="w-fit rounded-[10px] bg-[var(--kb-surface2)] p-[3px]"
            >
              {PATH_MODE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="min-h-10 rounded-lg px-4 text-sm data-[state=on]:bg-[var(--kb-surface)] data-[state=on]:font-semibold data-[state=on]:text-[var(--kb-accent)] data-[state=on]:shadow-[var(--kb-shadow-sm)]"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-sm text-[var(--kb-muted)]">
              {PATH_MODE_OPTIONS.find((option) => option.value === pathMode)?.description}
            </p>
          </fieldset>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className="font-semibold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">חשבון</h2>
          {!syncAvailable ? (
            <p className="text-sm text-[var(--kb-muted)]">
              סנכרון בין מכשירים אינו זמין בהתקנה זו. כל הנתונים נשמרים במכשיר הזה בלבד; לגיבוי השתמש בייצוא למטה.
            </p>
          ) : email ? (
            <>
              <p className="text-sm text-[var(--kb-text)]">{`מחובר כ: \u2066${email}\u2069`}</p>
              <Button type="button" variant="outline" onClick={handleSignOut} className="w-fit">
                התנתק
              </Button>
              <p className="text-sm text-[var(--kb-muted)]">{`מסונכרן לאחרונה: ${formatLastSynced(lastSyncedAt)}`}</p>
              <Button type="button" variant="outline" onClick={handleSyncNow} className="w-fit">
                סנכרן עכשיו
              </Button>
            </>
          ) : (
            <form onSubmit={handleSendMagicLink} className="flex flex-col gap-2">
              <p className="text-sm text-[var(--kb-muted)]">התחבר כדי לסנכרן נתונים בין מכשירים.</p>
              <label htmlFor="settings-email" className="text-sm font-medium text-[var(--kb-text)]">
                כתובת אימייל
              </label>
              <Input
                id="settings-email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
              />
              <Button type="submit" variant="outline" disabled={isSending} className="w-fit">
                שלח קישור התחברות
              </Button>
            </form>
          )}
        </section>

        <section className={SECTION_CLASS}>
          <h2 className="font-semibold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">אפליקציה</h2>
          {canInstall ? (
            <>
              <p className="text-sm text-[var(--kb-muted)]">התקן את האתר כאפליקציה במסך הבית לגישה מהירה ולעבודה ללא חיבור.</p>
              <Button type="button" variant="outline" onClick={promptInstall} className="w-fit">
                <Download aria-hidden="true" size={16} />
                התקן אפליקציה
              </Button>
            </>
          ) : (
            <p className="text-sm text-[var(--kb-muted)]">
              האפליקציה כבר מותקנת, או שהדפדפן הזה לא מציע התקנה. ב-iOS: שיתוף ← "הוסף למסך הבית".
            </p>
          )}
        </section>

        <section className={SECTION_CLASS}>
          <h2 className="font-semibold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">ייצוא נתונים</h2>
          <p className="text-sm text-[var(--kb-muted)]">
            שמור קובץ גיבוי של כל הנתונים האישיים שלך — התקדמות, מועדפים, הערות וכרטיסיות.
          </p>
          <Button type="button" variant="outline" onClick={handleExport} className="w-fit">
            ייצא את הנתונים שלי
          </Button>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className="font-semibold [font-family:var(--kb-font-heading)] text-[var(--kb-text)]">ייבוא נתונים</h2>
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
          <Button type="button" variant="outline" onClick={handleImportClick} className="w-fit">
            ייבוא נתונים
          </Button>
        </section>
      </main>
    </>
  );
}
