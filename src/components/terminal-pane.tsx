// The content pane while a shell or edit session is open: the embedded
// terminal fills the body and, while focused and running, receives every key
// except the detach chord. Detaching just moves focus to the tree; the
// session keeps running and Tab re-attaches.

import { createMemo, onCleanup, onMount, Show } from "solid-js";
import type { BoxRenderable, Renderable } from "@opentui/core";
import {
  Pane,
  PaneHeader,
  useFocus,
  useKeyPassthrough,
  useScope,
  useTheme,
} from "@andycmaj/opentui-app";
import { Commands } from "../commands";
import { useTerminal, type Terminal } from "../context/terminal";
import { encodeKey } from "../terminal/key-encode";

export function TerminalPane() {
  const terminal = useTerminal();
  const theme = useTheme();
  const { setActivePane, isPaneFocused } = useFocus();
  const state = () => terminal.state();
  const running = () => state()?.running ?? false;
  const attached = () => running() && isPaneFocused("content");

  let pane: Renderable | undefined;
  let host: BoxRenderable | undefined;
  let current: Terminal | null = null;
  let size = { cols: 0, rows: 0 };

  function fit() {
    if (!host || !current) return;
    const cols = Math.max(10, host.width);
    const rows = Math.max(3, host.height);
    if (cols === size.cols && rows === size.rows) return;
    size = { cols, rows };
    current.view.resizeTerminal(cols, rows);
    current.session.resize(cols, rows);
  }

  onMount(() => {
    // Layout isn't computed until the first frame; start at the real size so
    // the program doesn't draw for 80x24 and then reflow.
    const start = () => {
      if (!host || host.width <= 0 || host.height <= 0) {
        setTimeout(start, 16);
        return;
      }
      current = terminal.attach(host.width, host.height);
      if (!current) return;
      size = { cols: 0, rows: 0 };
      host.add(current.view);
      fit();
      host.onSizeChange = fit;
    };
    start();
  });

  onCleanup(() => {
    if (host && current) host.remove(current.view);
  });

  useKeyPassthrough(
    "terminal",
    (event) => {
      const bytes = encodeKey(event);
      if (bytes) current?.session.write(bytes);
    },
    { target: () => pane, enabled: running },
  );

  useScope(
    "terminal",
    {
      [Commands.TERMINAL_DETACH]: () => {
        if (running()) {
          setActivePane("tree");
          return;
        }
        terminal.close();
        // The content pane remounts as the document view; focus follows it.
        setActivePane("content");
      },
    },
    { target: () => pane },
  );

  const status = createMemo(() => {
    const s = state();
    if (!s) return null;
    if (!s.running)
      return {
        text: `exited ${s.exitCode ?? "?"}`,
        color: s.exitCode === 0 ? theme.textMuted : theme.error,
      };
    return attached()
      ? { text: "attached", color: theme.success }
      : { text: "detached", color: theme.warning };
  });

  return (
    <Pane name="content" ref={(r) => (pane = r)}>
      <PaneHeader title={state()?.request.title ?? "Terminal"}>
        <text flexShrink={0}>
          <Show when={state()?.request.tag}>
            <span style={{ fg: theme.textMuted }}>
              {" "}
              [{state()?.request.tag}]
            </span>
          </Show>
          <Show when={status()}>
            <span style={{ fg: status()?.color }}> [{status()?.text}]</span>
          </Show>
        </text>
      </PaneHeader>
      <box
        ref={(r: BoxRenderable) => (host = r)}
        marginLeft={2}
        marginRight={1}
        flexGrow={1}
      />
      <box
        padding={1}
        paddingBottom={0}
        paddingLeft={2}
        flexShrink={0}
        flexDirection="row"
      >
        <Show
          when={running()}
          fallback={
            <text>
              <span style={{ fg: theme.primary }}>^]</span>
              <span style={{ fg: theme.textMuted }}> close</span>
            </text>
          }
        >
          <Show
            when={attached()}
            fallback={
              <text>
                <span style={{ fg: theme.primary }}>Tab</span>
                <span style={{ fg: theme.textMuted }}> attach · </span>
                <span style={{ fg: theme.primary }}>x</span>
                <span style={{ fg: theme.textMuted }}>
                  {" "}
                  close session (from tree)
                </span>
              </text>
            }
          >
            <text>
              <span style={{ fg: theme.primary }}>^]</span>
              <span style={{ fg: theme.textMuted }}> detach</span>
            </text>
          </Show>
        </Show>
      </box>
    </Pane>
  );
}
