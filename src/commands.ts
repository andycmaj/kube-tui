// App commands: the framework's base commands plus kube-tui's own.

import { BaseCommands } from "@andycmaj/opentui-app";

export const Commands = {
  ...BaseCommands,

  // App-level
  NAMESPACE_PICK: "namespace.pick",
  QUICK_SEARCH: "search.quick",

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
  CONTENT_SEARCH: "content.search",
  CONTENT_SEARCH_CLEAR: "content.search.clear",
  LOG_CONTAINER: "logs.container",

  // Embedded terminal
  SHELL_OPEN: "terminal.shell",
  EDIT_OPEN: "terminal.edit",
  TERMINAL_DETACH: "terminal.detach",
  TERMINAL_CLOSE: "terminal.close",

  // Mutations (confirmed in a dialog)
  OBJECT_DELETE: "object.delete",
  ROLLOUT_RESTART: "object.restart",
  OBJECT_SCALE: "object.scale",
} as const;
