// Flattens the category > kind > object hierarchy into visible rows, honouring
// expansion. Everything starts collapsed (absent from `expanded`).

import type { Category } from "./catalog";
import type { CustomGroup } from "./discovery";
import { resourceArg, type KindDef, type KubeObject } from "./types";

export const NodeType = {
  CATEGORY: "category",
  GROUP: "group",
  KIND: "kind",
  OBJECT: "object",
  LOADING: "loading",
} as const;
export type NodeType = (typeof NodeType)[keyof typeof NodeType];

export type TreeNode =
  | {
      type: "category";
      id: string;
      title: string;
      count: number;
      expanded: boolean;
      depth: number;
    }
  | {
      type: "group";
      id: string;
      title: string;
      count: number;
      expanded: boolean;
      depth: number;
    }
  | {
      type: "kind";
      id: string;
      def: KindDef;
      count: number | null;
      expanded: boolean;
      depth: number;
    }
  | {
      type: "object";
      id: string;
      def: KindDef;
      object: KubeObject;
      depth: number;
    }
  | { type: "loading"; id: string; title: string; depth: number };

export const CUSTOM_CATEGORY_ID = "cat:custom";

export function kindKey(def: KindDef): string {
  return resourceArg(def);
}

export interface TreeInput {
  categories: Category[];
  customGroups: CustomGroup[] | null;
  expanded: Record<string, boolean>;
  // Objects for kinds with an active watch; absent = not loaded yet.
  objects: Record<string, KubeObject[] | undefined>;
}

function pushKind(
  nodes: TreeNode[],
  input: TreeInput,
  def: KindDef,
  depth: number,
): void {
  const key = kindKey(def);
  const id = `kind:${key}`;
  const expanded = input.expanded[id] ?? false;
  const objects = input.objects[key];
  nodes.push({
    type: "kind",
    id,
    def,
    count: objects?.length ?? null,
    expanded,
    depth,
  });
  if (!expanded) return;
  if (!objects) {
    nodes.push({
      type: "loading",
      id: `${id}:loading`,
      title: "loading…",
      depth: depth + 1,
    });
    return;
  }
  for (const object of objects) {
    nodes.push({
      type: "object",
      id: `obj:${object.metadata.uid}`,
      def,
      object,
      depth: depth + 1,
    });
  }
}

export function buildTree(input: TreeInput): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const cat of input.categories) {
    const id = `cat:${cat.id}`;
    const expanded = input.expanded[id] ?? false;
    nodes.push({
      type: "category",
      id,
      title: cat.title,
      count: cat.kinds.length,
      expanded,
      depth: 0,
    });
    if (expanded) for (const def of cat.kinds) pushKind(nodes, input, def, 1);
  }

  const groups = input.customGroups;
  if (groups === null) {
    nodes.push({
      type: "loading",
      id: CUSTOM_CATEGORY_ID,
      title: "Custom Resources",
      depth: 0,
    });
    return nodes;
  }
  const expanded = input.expanded[CUSTOM_CATEGORY_ID] ?? false;
  nodes.push({
    type: "category",
    id: CUSTOM_CATEGORY_ID,
    title: "Custom Resources",
    count: groups.length,
    expanded,
    depth: 0,
  });
  if (!expanded) return nodes;
  for (const group of groups) {
    const gid = `grp:${group.group}`;
    const gExpanded = input.expanded[gid] ?? false;
    nodes.push({
      type: "group",
      id: gid,
      title: group.group,
      count: group.kinds.length,
      expanded: gExpanded,
      depth: 1,
    });
    if (gExpanded)
      for (const def of group.kinds) pushKind(nodes, input, def, 2);
  }
  return nodes;
}

export function isExpandable(node: TreeNode): boolean {
  return (
    node.type === "category" || node.type === "group" || node.type === "kind"
  );
}
