# 05 — PWA, Offline ו-Deployment

## PWA — התקנה ואופליין (העדיפות לניידות)
המטרה: להתקין על הטלפון כמו אפליקציה, ולעבוד בלי אינטרנט.

### הגדרה
השתמש ב־**vite-plugin-pwa** (Workbox). ב־`vite.config.ts`:
- `registerType: 'autoUpdate'`.
- **precache** של ה־app shell (JS/CSS/HTML), הפונטים (woff2), `topics.clean.json`, `modules.json`, `search-index.json`.
- **runtime caching**:
  - `topic-content/*.html` ו־`topic-assets/*` (תמונות): `CacheFirst` עם expiration — כך שנושא שנקרא פעם זמין אופליין.
  - KaTeX (אם מ־CDN): `CacheFirst`. עדיף לארוז מקומית.
  - קריאות Supabase: **NetworkOnly** (לא לשמור נתוני API ב־SW; ה־offline מטופל ב־IndexedDB).

### manifest (`public/manifest.webmanifest`)
```json
{
  "name": "מסד ידע — AI Engineer",
  "short_name": "מסד ידע",
  "lang": "he", "dir": "rtl",
  "start_url": "/", "display": "standalone",
  "background_color": "#0f1220", "theme_color": "#0f1220",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
הוסף `<meta name="theme-color">` ומטא־תגי iOS (`apple-mobile-web-app-capable`, `apple-touch-icon`). צור אייקונים (192/512/maskable) מהלוגו הקיים (האות Σ).

### כפתור התקנה
תפוס `beforeinstallprompt`, הצג כפתור "התקן אפליקציה" ב־header/settings כשזמין.

## אופטימיזציית משקל (חשוב למובייל)
- **פונטים: woff2 בלבד** — הסר ttf/woff הכפולים (~0.8MB חיסכון). שקול `font-display: swap` ו־subset עברי+לטיני.
- **KaTeX**: import דינמי, נטען רק כשמוצגת נוסחה.
- **פיצול קוד**: כל עמוד (Flashcards/Quiz/Map) ב־`lazy()` + `Suspense`.
- **תמונות**: כבר חולצו (מסמך 02), נטענות `lazy`.
- יעד: first load < 500KB (ללא תמונות התוכן), Lighthouse PWA + Performance ירוקים.

## Deployment

### אירוח: Cloudflare Pages (מומלץ) או Netlify
- חבר את ריפו ה־git; build command `npm run build`, output `dist/`.
- brotli/gzip אוטומטי, HTTPS, CDN גלובלי, חינם.
- **SPA fallback**: הפניית 404 → `index.html` (Cloudflare: `_redirects` עם `/* /index.html 200`).

### משתני סביבה בבנייה
הגדר בפאנל האירוח: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### דומיין
חבר דומיין מותאם (או subdomain) דרך פאנל האירוח; HTTPS אוטומטי.

### הגדרת Supabase לפרודקשן
- ב־Supabase Dashboard: הרץ `supabase/schema.sql`, ודא RLS פעיל, הוסף את דומיין האתר ל־**Auth redirect URLs** (למג'יק לינק).

### CI (אופציונלי)
GitHub Actions: על push ל־main — lint + typecheck + build + (Playwright smoke). Cloudflare/Netlify מריצים deploy אוטומטי בעצמם.

## בדיקות קבלה לפני "חי"
- [ ] Lighthouse: PWA installable ✓, Performance/Accessibility/Best-practices ירוקים.
- [ ] התקנה בפועל על טלפון (iOS + Android), פתיחה במסך מלא.
- [ ] Offline: כיבוי רשת → עיון בנושאים שנקראו, חיפוש, כרטיסיות — עובד.
- [ ] סנכרון: שינוי במחשב מופיע בטלפון אחרי התחברות.
- [ ] RTL תקין, בהיר+כהה, נגישות מקלדת — בפרודקשן.
- [ ] נוסחאות KaTeX נטענות ומוצגות נכון.
