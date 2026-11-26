export interface FindMatch {
  start: number;
  end: number;
}

/** Find all non-overlapping, case-sensitive occurrences of query in text. */
export function findMatches(text: string, query: string): FindMatch[] {
  if (!query) return [];

  const matches: FindMatch[] = [];
  let index = text.indexOf(query);

  while (index !== -1) {
    const end = index + query.length;
    matches.push({ start: index, end });
    index = text.indexOf(query, end);
  }

  return matches;
}

export function getNextMatchIndex(currentIndex: number, matchCount: number): number {
  if (matchCount <= 0) return -1;
  if (currentIndex < 0) return 0;
  return (currentIndex + 1) % matchCount;
}

export function getPreviousMatchIndex(currentIndex: number, matchCount: number): number {
  if (matchCount <= 0) return -1;
  if (currentIndex < 0) return matchCount - 1;
  return (currentIndex - 1 + matchCount) % matchCount;
}

/** Return the match exactly covered by a selection, if there is one. */
export function findExactMatchIndex(
  matches: FindMatch[],
  start: number,
  end: number
): number {
  return matches.findIndex((match) => match.start === start && match.end === end);
}

/**
 * Choose the next match after a replacement. Matches inside the replacement
 * itself are skipped so repeating Replace cannot keep selecting the same text
 * forever when replacement contains the query. If no later match exists,
 * selection wraps to the first remaining match.
 */
export function getMatchIndexAfterReplacement(
  matches: FindMatch[],
  replacementStart: number,
  replacementLength: number
): number {
  if (matches.length === 0) return -1;

  const replacementEnd = replacementStart + Math.max(0, replacementLength);
  const index = matches.findIndex((match) => match.start >= replacementEnd);
  return index === -1 ? 0 : index;
}

/** Replace exactly the supplied match, not merely the first occurrence. */
export function replaceMatch(
  text: string,
  match: FindMatch,
  replacement: string
): string {
  return text.slice(0, match.start) + replacement + text.slice(match.end);
}
