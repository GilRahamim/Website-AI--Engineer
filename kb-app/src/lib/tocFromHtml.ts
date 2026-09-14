export interface TocHeading {
  id: string;
  text: string;
}

/**
 * Extracts the section headings (`.sec-h`) from a topic's fetched HTML and
 * returns a copy of the markup where each heading carries a stable id, so the
 * table of contents can link to it. Only ids are added — golden rule 1: the
 * heading text and every other node are left untouched.
 */
export function buildToc(html: string): { headings: TocHeading[]; html: string } {
  const headings: TocHeading[] = [];
  let index = 0;
  const out = html.replace(/<h([1-6])([^>]*class=['"][^'"]*\bsec-h\b[^'"]*['"][^>]*)>([\s\S]*?)<\/h\1>/g, (_match, level, attrs, inner) => {
    index += 1;
    const id = `sec-${index}`;
    headings.push({ id, text: inner.replace(/<[^>]+>/g, '').trim() });
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
  return { headings, html: out };
}
