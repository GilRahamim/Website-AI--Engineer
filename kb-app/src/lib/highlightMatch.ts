export interface HighlightSegment {
  text: string;
  match: boolean;
}

export function highlightMatch(text: string, query: string): HighlightSegment[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [{ text, match: false }];

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, cursor);
    if (matchIndex === -1) {
      segments.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (matchIndex > cursor) {
      segments.push({ text: text.slice(cursor, matchIndex), match: false });
    }
    segments.push({ text: text.slice(matchIndex, matchIndex + trimmedQuery.length), match: true });
    cursor = matchIndex + trimmedQuery.length;
  }

  return segments.length > 0 ? segments : [{ text, match: false }];
}
