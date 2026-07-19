# 02 — מודל נתונים ומיגרציה

## מקור האמת
`data/topics.raw.json` — **160 נושאים** שחולצו מהקובץ הקיים. `data/modules.json` — 5 מודולים.

התפלגות: 45 algorithms, 69 concepts, 25 architectures, 13 metrics, 8 formulas.
מודולים: Intro to Data Science (8), Unsupervised Learning (18), NLP (24), Deep Learning (43), RAG/Agents/MCP (67).
**90 נושאים מכילים תמונות base64 מוטמעות** בתוך `content_html` (ממוצע 41KB/נושא → 7.9MB בסך הכל).

## סכימת נושא (raw, קיים)
כל פריט ב־`topics.raw.json`:

```jsonc
{
  "id": "Intro to Data Science::algorithms::02_Linear_Regression.docx", // מזהה יציב וייחודי — מפתח לכל נתוני המשתמש
  "module": "Intro to Data Science",
  "module_label": "מבוא למדעי הנתונים",
  "category": "algorithms",              // algorithms|concepts|metrics|formulas|architectures
  "category_icon": "⚙️",
  "category_label": "אלגוריתמים",
  "num": 2,
  "filename": "02_Linear_Regression.docx",
  "slug_name": "Linear Regression",
  "title": "Linear Regression — רגרסיה לינארית",
  "definition": "…",                     // תקציר קצר (לכרטיס)
  "content_html": "…",                   // גוף מלא (HTML), מכיל נוסחאות KaTeX ותמונות base64
  "related_raw": ["…"],                  // תוויות נושאים קשורים
  "related_match": ["id-or-null", …],    // מזהי היעד (158/160 עם קישורים)
  "link": "…",
  "_search": "…"                          // טקסט מנורמל לחיפוש (קיים)
}
```

## משימת המיגרציה — `scripts/migrate-data.mjs`
סקריפט חד־פעמי (Node) שממיר `topics.raw.json` → `src/data/topics.clean.json` + נכסים. **אין לגעת בטקסט/הגדרות** — רק לחלץ, לנקות ולבנות אינדקסים.

### שלבי הסקריפט
1. **חילוץ תמונות base64.** בכל `content_html`, מצא `src="data:image/…;base64,…"`, שמור כל תמונה כקובץ תחת `public/topic-assets/<hash>.<ext>`, והחלף ב־`src="/topic-assets/<hash>.<ext>"` עם `loading="lazy"`. → מקטין את ה־JSON מ־7.9MB ל־~1MB, ומאפשר cache/lazy-load נפרד לתמונות.
2. **פיצול תוכן.** הפרד `content_html` הכבד לקובץ נפרד פר־נושא: `public/topic-content/<safe-id>.html`, כדי שהעמוד הראשי (רשת/חיפוש) יטען רק כותרות+הגדרות. הקורא טוען את התוכן המלא בזמן פתיחה (lazy). → העמוד הראשי קליל מאוד.
3. **בניית `topics.clean.json`** — מטא־דאטה בלבד לכל נושא: `id, module, module_label, category, category_label, num, slug_name, title, definition, related_raw, related_match, contentPath`. בלי `content_html` הכבד.
4. **אינדקס חיפוש מנורמל** — `search-index.json`: לכל נושא, `id` + טקסט חיפוש **מנורמל** (ראה למטה).
5. **ולידציה** — בדוק ש:
   - כל `related_match` שאינו null מצביע ל־`id` קיים (דווח על יתומים).
   - כל `contentPath` קיים בפועל.
   - כל תמונה שחולצה נשמרה בהצלחה.
   הדפס דו"ח סיכום (נושאים, תמונות שחולצו, קישורים שבורים).

### נרמול עברית לחיפוש (חשוב)
בנה שדה חיפוש שמסיר ניקוד ומאחד תווים, כדי ש"רגרסיה" ימצא גם "רְגרֶסיה":
```js
const normalize = (s) => s
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[֑-ׇ]/g, '')      // ניקוד וטעמים
  .replace(/["'`׳״]/g, '')               // גרשיים/גרש
  .replace(/[-–—_]/g, ' ')               // מקפים לרווח (K-Means → k means)
  .replace(/\s+/g, ' ')
  .trim();
```
אחסן גם `title` וגם `definition` מנורמלים. החיפוש בזמן ריצה מנרמל את שאילתת המשתמש באותה פונקציה.

## נתוני משתמש (מקומי + סנכרון)
נתונים אלה נוצרים בזמן שימוש, נשמרים ב־IndexedDB, ומסונכרנים ל־Supabase (מסמך 04). כולם ממופתחים לפי `topicId` (= `topic.id`):

```ts
type Progress = { topicId: string; status: 'new'|'learning'|'mastered'; updatedAt: number };
type Note     = { topicId: string; text: string; updatedAt: number };
type Favorite = { topicId: string; createdAt: number };
type Recent   = { topicId: string; viewedAt: number };
type SrsCard  = {                    // חזרה מרווחת (ראה lib/srs.ts)
  topicId: string;
  ease: number;         // מקדם קלות (SM-2), התחלה 2.5
  intervalDays: number; // מרווח נוכחי
  dueAt: number;        // מתי להראות שוב (timestamp)
  reps: number;
  lapses: number;
  updatedAt: number;
};
```

## כללי זהב
- `topic.id` הוא המפתח היחיד לכל נתוני המשתמש — יציב, אל תשנה אותו.
- אל תערוך תוכן נושאים. חילוץ תמונות = החלפת `src` בלבד, לא שינוי טקסט.
- שמור את הסקריפט idempotent: הרצה חוזרת מייצרת אותה תוצאה (hash קבוע לתמונה זהה).
