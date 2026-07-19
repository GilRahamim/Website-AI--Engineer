# 01 — ארכיטקטורה ו-Stack

## עקרון־על: Local-first
האפליקציה עובדת במלואה בדפדפן, גם בלי רשת וגם בלי חשבון. כל הנתונים האישיים נשמרים ראשית ב־**IndexedDB** מקומי; Supabase הוא שכבת **סנכרון אופציונלית** מעל, לא תלות. משתמש בלי חשבון מקבל חוויה מלאה — רק בלי סנכרון בין מכשירים.

## Stack נבחר

| שכבה | בחירה | נימוק |
|------|--------|-------|
| Build/Bundler | **Vite** | מהיר, פשוט, סטטי־first, אידיאלי ל־PWA. |
| Framework | **React 18 + TypeScript** | תואם לבסיס הקיים; TS למניעת באגים ולתחזוקה. |
| עיצוב | **Tailwind CSS + CSS variables (OKLCH)** | לשמר את מערכת הצבעים הקיימת ב־OKLCH כ־tokens; utility מהיר ועקבי. |
| State | **Zustand** | קל, מתאים ל־local-first, פשוט יותר מ־Redux. |
| אחסון מקומי | **IndexedDB** (דרך `idb` או Dexie) | קיבולת גדולה (התקדמות, הערות, SRS) ומתאים ל־offline. |
| נוסחאות | **KaTeX** (טעינה עצלה) | קיים בבסיס; לטעון רק כשמוצגת נוסחה. |
| ראוטינג | **React Router** | דפים: בית, קורא נושא, כרטיסיות, מבחן, מפת ידע. |
| PWA | **vite-plugin-pwa** (Workbox) | manifest + service worker + offline בקונפיג פשוט. |
| בקאנד | **Supabase** (Auth + Postgres + RLS) | מנוהל, ללא שרת לתחזק; סנכרון וזיהוי מובנים. |
| אירוח | **Cloudflare Pages** (או Netlify) | חינם, HTTPS, brotli, דומיין מותאם, CI מ־git. |
| בדיקות | **Vitest + Testing Library**; **Playwright** ל־E2E קריטי | לוודא שאין רגרסיה בפיצ'רים ובנגישות. |

> אין צורך ב־Next.js: האפליקציה סטטית־first ומשתמש יחיד; Vite+PWA+Supabase פשוט וזול יותר. אין SSR נדרש.

## מבנה תיקיות

```
kb-app/
├─ public/
│  ├─ manifest.webmanifest
│  ├─ icons/                 # אייקוני PWA (192/512/maskable)
│  └─ topic-assets/          # תמונות שחולצו מה-content_html (ראה מסמך 02)
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ data/
│  │  ├─ topics.clean.json   # תוצר המיגרציה (בלי base64)
│  │  ├─ modules.json
│  │  └─ search-index.json   # אינדקס חיפוש מנורמל
│  ├─ lib/
│  │  ├─ db.ts               # IndexedDB (progress, notes, favorites, srs)
│  │  ├─ sync.ts             # סנכרון local ↔ Supabase
│  │  ├─ supabase.ts         # לקוח Supabase
│  │  ├─ search.ts           # חיפוש + נרמול עברית
│  │  ├─ srs.ts              # אלגוריתם חזרה מרווחת
│  │  └─ theme.ts            # tokens + החלפת ערכת נושא
│  ├─ store/                 # Zustand stores (ui, learning, auth)
│  ├─ components/            # רכיבי UI (ראה מסמך 03)
│  ├─ pages/                 # Home, Reader, Flashcards, Quiz, Map, Settings
│  └─ styles/
│     ├─ tokens.css          # משתני OKLCH (light/dark)
│     └─ index.css
├─ scripts/
│  └─ migrate-data.mjs       # סקריפט המיגרציה החד-פעמי
├─ supabase/
│  ├─ schema.sql             # טבלאות + RLS
│  └─ README.md
├─ .env.example
├─ CLAUDE.md
└─ vite.config.ts
```

## זרימת נתונים
- **תוכן (נושאים):** סטטי, נטען מ־`topics.clean.json`. לקריאה בלבד, אף פעם לא משתנה בזמן ריצה.
- **נתוני משתמש (התקדמות/הערות/מועדפים/SRS):** נכתבים ל־IndexedDB מיידית (optimistic). אם המשתמש מחובר — `sync.ts` דוחף/מושך ל־Supabase ברקע.
- **מזהי ישויות:** מפתח כל רשומת משתמש הוא `topic.id` הקיים (יציב, ייחודי) — כך אין צורך במיפוי נוסף.

## הפרדת אחריות
- `pages/` — הרכבת מסכים בלבד.
- `components/` — UI טהור, ללא לוגיקת דאטה.
- `lib/` — כל הלוגיקה (חיפוש, SRS, סנכרון, DB) — נבדקת ביחידה.
- `store/` — מצב אפליקציה בלבד (UI + learning), לא לוגיקה כבדה.

## אילוצים
- RTL מלא, עברית תקינה, בכל מסך.
- שתי ערכות נושא (בהיר/כהה) מלאות ועקביות, כברירת מחדל לפי העדפת המערכת.
- נגישות WCAG AA: `focus-visible`, ניווט מקלדת, ניגודים, `aria`.
- ללא localStorage לנתונים כבדים — IndexedDB בלבד (localStorage רק להעדפות קטנות כמו ערכת נושא).
