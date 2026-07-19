export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '') // Hebrew niqqud + cantillation marks
    .replace(/["'`׳״]/g, '') // geresh/gershayim/quotes
    .replace(/[-–—_]/g, ' ') // hyphens/dashes/underscore -> space
    .replace(/\s+/g, ' ')
    .trim();
}
