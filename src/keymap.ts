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
  { key: "s", cmd: Commands.SHELL_OPEN, desc: "shell", help: "shell" },
  { key: "e", cmd: Commands.EDIT_OPEN, desc: "edit", help: "edit" },
  {
    key: "ctrl+d",
    cmd: Commands.OBJECT_DELETE,
    desc: "delete",
    help: "delete",
  },
  { key: "shift+r", cmd: Commands.ROLLOUT_RESTART, desc: "rollout restart" },
  { key: "shift+s", cmd: Commands.OBJECT_SCALE, desc: "scale" },
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
    {
      key: "space",
      cmd: Commands.QUICK_SEARCH,
      desc: "quick search",
      help: "search",
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
    { key: "x", cmd: Commands.TERMINAL_CLOSE, desc: "close terminal session" },
    ...viewBindings,
  ],
  content: [
    ...navBindings(),
    ...viewBindings,
    { key: "f", cmd: Commands.SCROLL_FOLLOW, desc: "follow", help: "follow" },
    { key: "/", cmd: Commands.CONTENT_SEARCH, desc: "find", help: "find" },
    {
      key: "escape",
      cmd: Commands.CONTENT_SEARCH_CLEAR,
      desc: "clear find",
    },
    {
      key: "c",
      cmd: Commands.LOG_CONTAINER,
      desc: "log container",
      help: "container",
    },
  ],
  // While a session runs, every key but these goes to the PTY
  // (useKeyPassthrough), so keep this list to chords no program needs.
  terminal: [
    {
      key: "ctrl+]",
      cmd: Commands.TERMINAL_DETACH,
      desc: "detach",
      help: "detach",
    },
  ],
};
