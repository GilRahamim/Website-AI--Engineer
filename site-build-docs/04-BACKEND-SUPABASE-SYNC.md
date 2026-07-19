# 04 — בקאנד (Supabase) וסנכרון

## למה Supabase ולמה קל
לא צריך שרת מותאם. Supabase נותן Auth + Postgres + Row-Level Security מנוהלים. הבקאנד משמש **רק** לסנכרון נתוני המשתמש בין מכשירים. התוכן (נושאים) נשאר סטטי ב־frontend — לא נכנס ל־DB.

## Auth
- **Magic link (אימייל)** כברירת מחדל — ללא סיסמאות, מתאים למשתמש יחיד. (אפשר להוסיף Google OAuth בהמשך.)
- ללא התחברות, האפליקציה עובדת מלא מקומית. התחברות מפעילה סנכרון.

## סכימת DB — `supabase/schema.sql`
טבלה אחת לכל סוג נתון, כולן ממופתחות ל־`user_id` + `topic_id`. `topic_id` הוא ה־`topic.id` הסטטי מה־frontend (טקסט).

```sql
-- הפעל RLS על כל טבלה; מפתח משותף (user_id, topic_id) מונע כפילויות.

create table progress (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  status text not null check (status in ('new','learning','mastered')),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table notes (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table favorites (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table srs_cards (
  user_id uuid references auth.users on delete cascade,
  topic_id text not null,
  ease real not null default 2.5,
  interval_days real not null default 0,
  due_at timestamptz,
  reps int not null default 0,
  lapses int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
```

## מדיניות RLS (חובה — אבטחה)
לכל טבלה: כל משתמש רואה ומשנה **רק** את השורות שלו.

```sql
alter table progress enable row level security;
create policy "own rows" on progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- חזור על אותו pattern עבור notes, favorites, srs_cards.
```

## אסטרטגיית סנכרון — `src/lib/sync.ts` (Local-first)
עיקרון: IndexedDB הוא המקור המהיר; Supabase הוא הגיבוי/הסנכרון. אף פעם לא חוסמים UI על הרשת.

1. **כתיבה:** כל שינוי נכתב מיידית ל־IndexedDB (optimistic) עם `updated_at` מקומי, ומסומן `dirty`. אם מחובר — נדחף ל־Supabase (upsert) ברקע; בהצלחה מנקים את הדגל.
2. **בעת התחברות / עלייה / מרווח (למשל כל 60ש' + on-focus):** משיכת שינויים מהענן, ומיזוג.
3. **פתרון קונפליקטים:** **Last-write-wins לפי `updated_at`** לכל שדה־ישות. פשוט ומספיק למשתמש יחיד. יוצא דופן: `notes.text` — אם שני הצדדים dirty ושונים, שמור את הארוך יותר או צרף עם מפריד וסמן לבדיקה (עדיף לא לאבד טקסט).
4. **Offline:** שינויים נשארים `dirty` בתור; נדחפים כשחוזרת רשת (אפשר `navigator.onLine` + retry).
5. **אתחול מכשיר חדש:** אחרי התחברות ראשונה — משיכה מלאה של כל הטבלאות ל־IndexedDB.

```ts
// חוזה מודול הסנכרון
export async function pushDirty(): Promise<void>;         // דוחף רשומות dirty
export async function pullSince(ts: number): Promise<void>; // מושך שינויים וממזג (LWW)
export async function fullSync(): Promise<void>;          // push + pull מלא
export function startAutoSync(): () => void;              // מפעיל טיימר + מאזיני focus/online; מחזיר cleanup
```

## ייצוא/גיבוי (Settings)
כפתור "ייצא את הנתונים שלי" → JSON של כל נתוני המשתמש (progress/notes/favorites/srs). "ייבא" משחזר. עצמאי מהענן — ביטחון נוסף למשתמש.

## משתני סביבה
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (ב־`.env`, לא ב־git; `.env.example` עם placeholders). מפתח ה־anon בטוח לחשיפה בקליינט — RLS הוא שכבת האבטחה.
