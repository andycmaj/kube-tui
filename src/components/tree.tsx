// The resource tree (sidebar): categories > kinds > live objects. Selection is
// the cursor; it follows the selected node's id as the list changes.

import { createEffect, createMemo, For, on } from "solid-js";
import type { Renderable, ScrollBoxRenderable } from "@opentui/core";
import {
  contrastingForeground,
  Pane,
  PaneHeader,
  truncate,
  useFocus,
  useScope,
  useTheme,
  type Theme,
} from "@andycmaj/opentui-app";
import { Commands } from "../commands";
import { ContentView, useKube } from "../context/kube";
import {
  formatAge,
  healthCounts,
  summarize,
  type Health,
} from "../kube/status";
import { kindLabel } from "../kube/catalog";
import { isExpandable, type TreeNode } from "../kube/tree";
import { SidebarStatus } from "./sidebar-status";
import { useObjectActions } from "./object-actions";
import { useTerminal } from "../context/terminal";

const SIDEBAR_WIDTH = 42;

export function healthColor(theme: Theme, health: Health): string | undefined {
  switch (health) {
    case "ok":
      return theme.success;
    case "pending":
      return theme.warning;
    case "warn":
      return theme.warning;
    case "error":
      return theme.error;
    default:
      return theme.textMuted;
  }
}

function rowHeight(node: TreeNode | undefined): number {
  return node?.type === "object" ? 3 : 1;
}

export function Tree() {
  const kube = useKube();
  const { setActivePane, isPaneFocused } = useFocus();
  const theme = useTheme();
  const isFocused = () => isPaneFocused("tree");
  const actions = useObjectActions();
  const terminal = useTerminal();
  let scrollRef: ScrollBoxRenderable | undefined;
  let lastIndex = 0;

  const cursor = createMemo(() => {
    const nodes = kube.nodes();
    const idx = nodes.findIndex((n) => n.id === kube.state.selectedId);
    if (idx !== -1) return (lastIndex = idx);
    // The selected node vanished (collapsed or deleted): stay near it.
    return (lastIndex = Math.min(lastIndex, Math.max(nodes.length - 1, 0)));
  });

  createEffect(
    on(cursor, (index) => {
      const node = kube.nodes()[index];
      if (node && node.id !== kube.state.selectedId) kube.select(node.id);
      if (!scrollRef) return;
      let top = 0;
      const nodes = kube.nodes();
      for (let i = 0; i < index && i < nodes.length; i++)
        top += rowHeight(nodes[i]);
      const height = rowHeight(nodes[index]) === 3 ? 2 : 1;
      const visible = scrollRef.viewport.height ?? 10;
      if (top < scrollRef.scrollTop) scrollRef.scrollTo(top);
      else if (top + height > scrollRef.scrollTop + visible)
        scrollRef.scrollTo(top + height - visible);
    }),
  );

  function move(next: (index: number) => number) {
    const nodes = kube.nodes();
    const index = Math.max(0, Math.min(nodes.length - 1, next(cursor())));
    if (nodes[index]) kube.select(nodes[index].id);
  }

  const current = () => kube.nodes()[cursor()];

  function setExpandedAtCursor(expanded: boolean) {
    const node = current();
    if (node && isExpandable(node)) kube.setExpanded(node.id, expanded);
  }

  function showView(view: ContentView) {
    kube.setView(view);
    if (current()?.type === "object") setActivePane("content");
  }

  let pane: Renderable | undefined;
  useScope(
    "tree",
    {
      [Commands.NAV_DOWN]: () => move((i) => i + 1),
      [Commands.NAV_UP]: () => move((i) => i - 1),
      [Commands.NAV_TOP]: () => move(() => 0),
      [Commands.NAV_BOTTOM]: () => move(() => kube.nodes().length - 1),
      [Commands.TREE_TOGGLE]: () => {
        const node = current();
        if (!node) return;
        if (node.type === "object") setActivePane("content");
        else if (isExpandable(node) && "expanded" in node)
          kube.setExpanded(node.id, !node.expanded);
      },
      [Commands.TREE_EXPAND]: () => setExpandedAtCursor(true),
      [Commands.TREE_COLLAPSE]: () => setExpandedAtCursor(false),
      [Commands.TREE_COLLAPSE_ALL]: () => kube.collapseAll(),
      [Commands.VIEW_DESCRIBE]: () => showView(ContentView.DESCRIBE),
      [Commands.VIEW_YAML]: () => showView(ContentView.YAML),
      [Commands.VIEW_LOGS]: () => showView(ContentView.LOGS),
      [Commands.SHELL_OPEN]: () => actions.shell(),
      [Commands.EDIT_OPEN]: () => actions.edit(),
      [Commands.OBJECT_DELETE]: () => actions.delete(),
      [Commands.ROLLOUT_RESTART]: () => actions.restart(),
      [Commands.OBJECT_SCALE]: () => actions.scale(),
      [Commands.TERMINAL_CLOSE]: () => {
        if (!terminal.state()) return false;
        terminal.close();
        return true;
      },
    },
    { target: () => pane },
  );

  const totals = createMemo(() => {
    const objects = kube.nodes().filter((n) => n.type === "object");
    const counts = healthCounts(objects.map((n) => summarize(n.def, n.object)));
    return { counts, total: objects.length };
  });

  return (
    <Pane
      name="tree"
      variant="sidebar"
      width={SIDEBAR_WIDTH}
      ref={(r) => (pane = r)}
    >
      <PaneHeader title="Resources">
        <text fg={theme.textMuted} flexShrink={0}>
          <span style={{ fg: theme.error }}>✗ {totals().counts.error}</span>{" "}
          <span style={{ fg: theme.success }}>
            ✓ {totals().counts.ok}/{totals().total}
          </span>
        </text>
      </PaneHeader>

      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
        paddingLeft={1}
        flexGrow={1}
        stickyScroll={false}
      >
        <For each={kube.nodes()}>
          {(node, index) => (
            <Row
              node={node}
              selected={index() === cursor()}
              focused={isFocused()}
              theme={theme}
            />
          )}
        </For>
      </scrollbox>

      <SidebarStatus />
    </Pane>
  );
}

function Row(props: {
  node: TreeNode;
  selected: boolean;
  focused: boolean;
  theme: Theme;
}) {
  const highlight = () =>
    props.focused ? props.theme.primary : props.theme.secondary;
  const bg = () => (props.selected ? highlight() : undefined);
  const fg = (normal: string | undefined) =>
    props.selected ? contrastingForeground(highlight()) : normal;
  const indent = " ".repeat(props.node.depth * 2);
  const node = props.node;

  if (node.type === "object") {
    return (
      <ObjectRow
        node={node}
        selected={props.selected}
        theme={props.theme}
        bg={bg()}
        fg={fg}
      />
    );
  }

  if (node.type === "loading") {
    return (
      <box paddingLeft={1} backgroundColor={bg()}>
        <text fg={fg(props.theme.textMuted)}>
          {indent}⠋ {node.title}
        </text>
      </box>
    );
  }

  const isKind = node.type === "kind";
  const label = node.type === "kind" ? kindLabel(node.def) : node.title;
  const count = node.count === null ? "" : ` (${node.count})`;
  return (
    <box paddingLeft={1} backgroundColor={bg()}>
      <text
        fg={fg(isKind ? props.theme.text : props.theme.primary)}
        attributes={isKind ? 0 : 1}
      >
        {indent}
        {node.expanded ? "▼" : "▶"} {label}
        {count}
      </text>
    </box>
  );
}

function ObjectRow(props: {
  node: Extract<TreeNode, { type: "object" }>;
  selected: boolean;
  theme: Theme;
  bg: string | undefined;
  fg: (normal: string | undefined) => string | undefined;
}) {
  const summary = createMemo(() =>
    summarize(props.node.def, props.node.object),
  );
  const bar = () => healthColor(props.theme, summary().health);
  const meta = () => props.node.object.metadata;
  const width = 34 - props.node.depth * 2;
  const line2 = () =>
    [
      meta().namespace,
      formatAge(meta().creationTimestamp),
      ...summary().details,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <box
      flexDirection="column"
      marginLeft={1 + props.node.depth * 2}
      marginBottom={1}
      backgroundColor={props.bg}
    >
      <box flexDirection="row" gap={1}>
        <text bg={bar()}> </text>
        <text
          fg={props.fg(props.theme.text)}
          attributes={props.selected ? 1 : 0}
        >
          {truncate(meta().name, width - 4)}
        </text>
        <text fg={props.fg(props.theme.textMuted)}>
          {summary().ready ? `· ${summary().ready}` : ""}
        </text>
      </box>
      <box flexDirection="row" gap={1}>
        <text bg={bar()}> </text>
        <text fg={props.fg(props.theme.textMuted)}>
          {truncate(line2(), width)}
        </text>
      </box>
    </box>
  );
}
