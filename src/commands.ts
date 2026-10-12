// App commands: the framework's base commands plus kube-tui's own.

import { BaseCommands } from "@andycmaj/opentui-app";

export const Commands = {
  ...BaseCommands,

  // App-level
  NAMESPACE_PICK: "namespace.pick",

  // Tree
  TREE_TOGGLE: "tree.toggle",
  TREE_EXPAND: "tree.expand",
  TREE_COLLAPSE: "tree.collapse",
  TREE_COLLAPSE_ALL: "tree.collapse.all",

  // Content views (also reachable from the tree for the selected object)
  VIEW_DESCRIBE: "view.describe",
  VIEW_YAML: "view.yaml",
  VIEW_LOGS: "view.logs",
  SCROLL_FOLLOW: "scroll.follow",
} as const;
