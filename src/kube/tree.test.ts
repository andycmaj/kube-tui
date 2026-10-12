import { describe, expect, test } from "bun:test";
import { buildTree, CUSTOM_CATEGORY_ID, type TreeNode } from "./tree";
import { BUILTIN_CATEGORIES } from "./catalog";
import type { KubeObject } from "./types";

const ids = (nodes: TreeNode[]) => nodes.map((n) => n.id);
const pod = (name: string): KubeObject => ({
  apiVersion: "v1",
  kind: "Pod",
  metadata: { name, uid: `uid-${name}`, namespace: "default" },
});

describe("buildTree", () => {
  test("starts fully collapsed, with custom resources loading", () => {
    const nodes = buildTree({
      categories: BUILTIN_CATEGORIES,
      customGroups: null,
      expanded: {},
      objects: {},
    });
    expect(nodes.every((n) => n.depth === 0)).toBe(true);
    expect(nodes.map((n): string => n.type)).toEqual([
      ...BUILTIN_CATEGORIES.map(() => "category"),
      "loading",
    ]);
    expect(nodes.at(-1)?.id).toBe(CUSTOM_CATEGORY_ID);
  });

  test("expanding a kind shows loading until its watch delivers objects", () => {
    const expanded = { "cat:workloads": true, "kind:pods": true };
    const loading = buildTree({
      categories: BUILTIN_CATEGORIES,
      customGroups: [],
      expanded,
      objects: {},
    });
    expect(ids(loading)).toContain("kind:pods:loading");

    const loaded = buildTree({
      categories: BUILTIN_CATEGORIES,
      customGroups: [],
      expanded,
      objects: { pods: [pod("a"), pod("b")] },
    });
    const podsIdx = loaded.findIndex((n) => n.id === "kind:pods");
    expect(loaded[podsIdx]).toMatchObject({
      count: 2,
      expanded: true,
      depth: 1,
    });
    expect(ids(loaded.slice(podsIdx + 1, podsIdx + 3))).toEqual([
      "obj:uid-a",
      "obj:uid-b",
    ]);
    expect(loaded[podsIdx + 3].id).toBe("kind:deployments.apps");
  });

  test("custom groups nest under Custom Resources", () => {
    const nodes = buildTree({
      categories: [],
      customGroups: [
        {
          group: "acme.io",
          kinds: [
            {
              kind: "Widget",
              plural: "widgets",
              group: "acme.io",
              version: "v1",
              namespaced: true,
            },
          ],
        },
      ],
      expanded: { [CUSTOM_CATEGORY_ID]: true, "grp:acme.io": true },
      objects: {},
    });
    expect(nodes.map((n) => [n.id, n.depth])).toEqual([
      [CUSTOM_CATEGORY_ID, 0],
      ["grp:acme.io", 1],
      ["kind:widgets.acme.io", 2],
    ]);
  });
});
