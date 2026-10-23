// The quick-search palette's entries and ranking: every kind plus the objects
// known so far, matched by name. A leading kind word ("po nginx") scopes the
// search to that kind, k9s-style.

import { fuzzyScore } from "../search";
import { kindLabel } from "./catalog";
import { kindKey } from "./tree";
import type { KindDef, KubeObject } from "./types";

// Kinds snapshotted when the palette opens, so objects are findable before
// their kind is expanded. Events, Endpoints and ReplicaSets are left out:
// they are numerous and duplicate what their owners already show.
export const SNAPSHOT_EXCLUDED = new Set(["Event", "Endpoints", "ReplicaSet"]);

export type SearchTarget =
  | { type: "kind"; def: KindDef }
  | { type: "object"; def: KindDef; object: KubeObject };

export interface SearchEntry {
  id: string;
  label: string;
  target: SearchTarget;
  // Lower-case kind names this entry answers to in a scoped query.
  aliases: string[];
  // Strings the query is matched against; the best one counts.
  terms: string[];
}

function kindAliases(def: KindDef): string[] {
  return [
    def.kind.toLowerCase(),
    kindLabel(def).toLowerCase(),
    def.plural,
    ...(def.shortNames ?? []),
  ];
}

export function kindEntry(def: KindDef): SearchEntry {
  return {
    id: `kind:${kindKey(def)}`,
    label: kindLabel(def),
    target: { type: "kind", def },
    aliases: kindAliases(def),
    terms: [kindLabel(def), def.plural, ...(def.shortNames ?? [])],
  };
}

export function objectEntry(def: KindDef, object: KubeObject): SearchEntry {
  return {
    id: `obj:${object.metadata.uid}`,
    label: object.metadata.name,
    target: { type: "object", def, object },
    aliases: kindAliases(def),
    terms: [object.metadata.name],
  };
}

interface Scored {
  entry: SearchEntry;
  substring: boolean;
  score: number;
  length: number;
}

function scoreTerm(
  entry: SearchEntry,
  term: string,
  needle: string,
): Scored | null {
  const at = term.toLowerCase().indexOf(needle);
  if (at !== -1)
    return { entry, substring: true, score: at, length: term.length };
  const fuzzy = fuzzyScore(needle, term);
  return fuzzy === null
    ? null
    : { entry, substring: false, score: fuzzy, length: term.length };
}

function score(entry: SearchEntry, needle: string): Scored | null {
  let best: Scored | null = null;
  for (const term of entry.terms) {
    const hit = scoreTerm(entry, term, needle);
    if (hit && (!best || compare(hit, best) < 0)) best = hit;
  }
  return best;
}

function compare(a: Scored, b: Scored): number {
  if (a.substring !== b.substring) return a.substring ? -1 : 1;
  return a.score - b.score || a.length - b.length;
}

export function rankEntries(
  entries: SearchEntry[],
  query: string,
  limit = Infinity,
): SearchEntry[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let pool = entries;
  if (words.length > 1 && entries.some((e) => e.aliases.includes(words[0]))) {
    pool = entries.filter(
      (e) => e.target.type === "object" && e.aliases.includes(words[0]),
    );
    words.shift();
  }
  const needle = words.join(" ");
  if (!needle) {
    const kindsFirst = [...pool].sort(
      (a, b) =>
        Number(a.target.type === "object") - Number(b.target.type === "object"),
    );
    return kindsFirst.slice(0, limit);
  }
  const scored = pool.flatMap((e) => score(e, needle) ?? []);
  // Like tilt-tui: once anything contains the query verbatim, drop the
  // scattered fuzzy hits.
  const exact = scored.filter((s) => s.substring);
  return (exact.length > 0 ? exact : scored)
    .sort(compare)
    .slice(0, limit)
    .map((s) => s.entry);
}

// `kubectl get a,b,c` returns a mixed list; map each item back to its kind.
export function kindForObject(
  defs: KindDef[],
  object: KubeObject,
): KindDef | undefined {
  const slash = object.apiVersion.indexOf("/");
  const group = slash === -1 ? "" : object.apiVersion.slice(0, slash);
  return defs.find((d) => d.kind === object.kind && d.group === group);
}
