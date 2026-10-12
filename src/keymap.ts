// Declarative keymap, keyed by scope: "app" anywhere in the pane layout,
// "tree" and "content" while focus is within that pane.

import {
  baseAppBindings,
  navBindings,
  type BindingSpec,
  type KeymapTable,
} from "@andycmaj/opentui-app";
import { Commands } from "./commands";

export const PANES = ["tree", "content"];

// The tree moves a cursor rather than scrolling, so it has no paging.
const treeNav = navBindings().filter(
  (b) => b.cmd !== Commands.SCROLL_PAGEUP && b.cmd !== Commands.SCROLL_PAGEDOWN,
);

const viewBindings: BindingSpec[] = [
  { key: "d", cmd: Commands.VIEW_DESCRIBE, desc: "describe", help: "describe" },
  { key: "y", cmd: Commands.VIEW_YAML, desc: "yaml", help: "yaml" },
  { key: "l", cmd: Commands.VIEW_LOGS, desc: "logs", help: "logs" },
];

export const keymap: KeymapTable = {
  app: [
    ...baseAppBindings,
    {
      key: "n",
      cmd: Commands.NAMESPACE_PICK,
      desc: "namespace",
      help: "namespace",
    },
  ],
  tree: [
    ...treeNav,
    {
      key: "return",
      cmd: Commands.TREE_TOGGLE,
      desc: "expand / open",
      help: "expand",
    },
    { key: "right", cmd: Commands.TREE_EXPAND, desc: "expand" },
    { key: "left", cmd: Commands.TREE_COLLAPSE, desc: "collapse" },
    { key: "c", cmd: Commands.TREE_COLLAPSE_ALL, desc: "collapse all" },
    ...viewBindings,
  ],
  content: [
    ...navBindings(),
    ...viewBindings,
    { key: "s", cmd: Commands.SCROLL_FOLLOW, desc: "follow", help: "follow" },
  ],
};
