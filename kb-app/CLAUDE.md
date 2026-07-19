# CLAUDE.md — מסד ידע AI Engineer (אתר למידה)

קובץ הנחיות לריפו. Claude Code: קרא אותו לפני כל שינוי. המפרט המלא נמצא בתיקיית `site-build-docs/` (מסמכים 00–05).

## מה זה הפרויקט
אתר למידה אישי (PWA, local-first) ל־160 נושאי קורס AI Engineer. React + TypeScript + Vite + Tailwind, נתונים מקומיים ב־IndexedDB, סנכרון אופציונלי דרך Supabase. עברית, RTL, בהיר/כהה.

## גרסאות בפועל
הסקפולד (`npm create vite@latest`) הביא גרסאות עדכניות מהמתוכנן (React 18 / Vite 6 / TS 5 / ESLint 9): בפועל React 19.2.7, Vite 8.1.5, TypeScript 6.0.3, ESLint 10.7.0. יש לתכנן קוד חדש מול React 19 (ref כ-prop רגיל, אין `defaultProps` לקומפוננטות פונקציה, effects מחמירים יותר).

## פקודות
```bash
npm run dev        # פיתוח
npm run build      # בנייה לפרודקשן (dist/)
npm run preview    # תצוגת build
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run test       # Vitest
node scripts/migrate-data.mjs   # מיגרציית דאטה (חד-פעמי; מ-data/topics.raw.json)
```

## כללי זהב (אל תפר)
1. **התוכן קדוש.** אין לשנות טקסט/הגדרות/נוסחאות של נושאים. מותר רק מבנה, עיצוב ואינטראקציה.
2. **`topic.id` הוא המפתח היחיד** לכל נתוני המשתמש — יציב, לא משתנה.
3. **Local-first.** האפליקציה עובדת מלא בלי רשת ובלי חשבון. הבקאנד הוא סנכרון אופציונלי, לא תלות. אל תחסום UI על קריאת רשת.
4. **נתוני משתמש → IndexedDB.** localStorage רק להעדפות קטנות (ערכת נושא). לא לשמור תוכן כבד ב-localStorage.
5. **RTL + שתי ערכות נושא** חייבים לעבוד בכל מסך חדש. בדוק בשתיהן.
6. **נגישות היא דרישה:** `focus-visible` בכל אינטראקטיבי, ניווט מקלדת, ניגוד AA, `prefers-reduced-motion`. אל תמסור רכיב בלי זה.
7. **צבעים דרך tokens** (`--kb-*` ב-OKLCH) — לא ערכי צבע קשיחים ברכיבים.
8. **סודות לא ב-git.** `.env` בלבד; `.env.example` עם placeholders.

## מבנה (ראה מסמך 01 למלא)
`src/data` נתונים סטטיים · `src/lib` לוגיקה (db, sync, search, srs, theme) · `src/store` Zustand · `src/components` UI טהור · `src/pages` מסכים · `scripts/migrate-data.mjs` · `supabase/schema.sql`.

## סדר עבודה
בנה לפי השלבים במסמך `00-BUILD-README.md` (Phase 0→6). בסוף כל שלב: build ירוק, typecheck נקי, בדיקה ידנית בבהיר+כהה+RTL, אין רגרסיה. Phase 2+ — בדיקה במובייל.

## הגדרת "בוצע" למשימה
קוד עובר typecheck+lint+build · נבדק בשתי ערכות נושא · נגיש במקלדת · RTL תקין · בלי `console.error` · בלי ערכי צבע/מרווח קשיחים שעוקפים tokens.

## כשלא בטוח
אם החלטה משנה ארכיטקטורה (stack, סכימת DB, אסטרטגיית סנכרון) — עצור ושאל, אל תניח. שאר ההחלטות: פעל לפי המפרט.
