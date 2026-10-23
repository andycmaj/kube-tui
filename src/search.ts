// Text matching shared by the quick-search palette and the content search.

import type { LogSearchFilter } from "@andycmaj/opentui-app";

// Each needle character must appear in order; the score sums the gaps
// between hits, so lower is tighter. null = no match.
export function fuzzyScore(needle: string, haystack: string): number | null {
  const hay = haystack.toLowerCase();
  let score = 0;
  let from = 0;
  for (const char of needle.toLowerCase()) {
    const at = hay.indexOf(char, from);
    if (at === -1) return null;
    score += at - from;
    from = at + 1;
  }
  return score;
}

// `/pattern/flags` is a regex (case-insensitive unless flags are given);
// anything else is a case-insensitive substring. An invalid regex comes back
// with `regex: null` so the caller can say so instead of searching literally.
export function parseSearchQuery(input: string): LogSearchFilter | null {
  const query = input.trim();
  if (!query) return null;
  const match = /^\/(.+)\/([gimsuy]*)$/.exec(query);
  if (!match) return { query, isRegex: false, regex: null };
  try {
    return {
      query,
      isRegex: true,
      regex: new RegExp(match[1], match[2] || "i"),
    };
  } catch {
    return { query, isRegex: true, regex: null };
  }
}
