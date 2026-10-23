import { describe, expect, test } from "bun:test";
import { BUILTIN_CATEGORIES } from "./catalog";
import {
  kindEntry,
  kindForObject,
  objectEntry,
  rankEntries,
  type SearchEntry,
} from "./quick-search";
import type { KindDef, KubeObject } from "./types";

const kinds = BUILTIN_CATEGORIES.flatMap((c) => c.kinds);
const def = (kind: string): KindDef => {
  const found = kinds.find((k) => k.kind === kind);
  if (!found) throw new Error(kind);
  return found;
};
const obj = (kind: string, name: string, apiVersion = "v1"): KubeObject => ({
  apiVersion,
  kind,
  metadata: { name, namespace: "default", uid: `${kind}-${name}` },
});

const entries: SearchEntry[] = [
  kindEntry(def("Pod")),
  kindEntry(def("Service")),
  objectEntry(def("Pod"), obj("Pod", "nginx-7d9f")),
  objectEntry(def("Pod"), obj("Pod", "postgres-0")),
  objectEntry(def("Service"), obj("Service", "nginx")),
  objectEntry(
    def("Deployment"),
    obj("Deployment", "ingress-nginx-controller", "apps/v1"),
  ),
];

const ids = (list: SearchEntry[]) => list.map((e) => e.id);

describe("rankEntries", () => {
  test("an empty query lists kinds before objects", () => {
    const ranked = rankEntries(entries, "");
    expect(ranked.slice(0, 2).every((e) => e.target.type === "kind")).toBe(
      true,
    );
    expect(ranked).toHaveLength(entries.length);
  });

  test("substring hits replace fuzzy ones, earliest hit first", () => {
    expect(ids(rankEntries(entries, "nginx"))).toEqual([
      "obj:Service-nginx",
      "obj:Pod-nginx-7d9f",
      "obj:Deployment-ingress-nginx-controller",
    ]);
  });

  test("falls back to fuzzy matching", () => {
    expect(ids(rankEntries(entries, "pgs"))).toEqual(["obj:Pod-postgres-0"]);
  });

  test("kinds match on their plural and short names", () => {
    expect(ids(rankEntries(entries, "svc"))).toEqual(["kind:services"]);
  });

  test("a leading kind word scopes the search to that kind", () => {
    expect(ids(rankEntries(entries, "po nginx"))).toEqual([
      "obj:Pod-nginx-7d9f",
    ]);
    expect(ids(rankEntries(entries, "svc ngx"))).toEqual(["obj:Service-nginx"]);
  });

  test("caps the result count", () => {
    expect(rankEntries(entries, "", 3)).toHaveLength(3);
  });
});

describe("kindForObject", () => {
  test("resolves a listed object's kind by group and kind", () => {
    expect(
      kindForObject(kinds, obj("Deployment", "web", "apps/v1"))?.plural,
    ).toBe("deployments");
    expect(kindForObject(kinds, obj("Pod", "web"))?.plural).toBe("pods");
    expect(
      kindForObject(kinds, obj("Widget", "w", "acme.io/v1")),
    ).toBeUndefined();
  });
});
