// The content pane: describe (default), YAML or logs for the selected object,
// or kubectl's own table for a selected kind. Every view is text rendered by
// the framework's LogBufferView from one in-memory LogSource, keyed per view.

import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  Show,
} from "solid-js";
import type { Renderable } from "@opentui/core";
import {
  createMemoryLogSource,
  errorMessage,
  Footer,
  LogBufferView,
  Pane,
  PaneHeader,
  useScope,
  useTheme,
  useToast,
} from "@andycmaj/opentui-app";
import { Commands } from "../commands";
import { ContentView, useKube } from "../context/kube";
import { kindLabel } from "../kube/catalog";
import { kubectlCommand, runKubectl } from "../kube/kubectl";
import { kindKey, type TreeNode } from "../kube/tree";
import { resourceArg, type KindDef, type KubeObject } from "../kube/types";
import { ALL_NAMESPACES, namespaceArgs } from "../kube/watch";
import { useObjectActions } from "./object-actions";

const LOGGABLE = new Set([
  "Pod",
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "ReplicaSet",
  "Job",
]);
const TABLE_REFRESH_MS = 1000;
const LOG_TAIL = "500";

type Doc =
  | {
      kind: "describe" | "yaml" | "logs";
      key: string;
      def: KindDef;
      object: KubeObject;
    }
  | { kind: "table"; key: string; def: KindDef }
  | { kind: "none"; message: string };

function objectArgs(def: KindDef, object: KubeObject): string[] {
  const ns = object.metadata.namespace;
  return [resourceArg(def), object.metadata.name, ...(ns ? ["-n", ns] : [])];
}

function docFor(
  node: TreeNode | undefined,
  view: ContentView,
  namespace: string,
): Doc {
  if (!node) return { kind: "none", message: "Select a resource to describe." };
  if (node.type === "kind") {
    return {
      kind: "table",
      key: `table:${kindKey(node.def)}@${namespace}`,
      def: node.def,
    };
  }
  if (node.type !== "object")
    return { kind: "none", message: "Expand a kind to list its resources." };
  const { def, object } = node;
  if (view === ContentView.LOGS && !LOGGABLE.has(def.kind)) {
    return { kind: "none", message: `${def.kind} has no logs.` };
  }
  return { kind: view, key: `${view}:${object.metadata.uid}`, def, object };
}

// kubectl --timestamps prefixes each line with an RFC 3339 time.
function splitTimestamp(line: string): { time?: string; text: string } {
  const space = line.indexOf(" ");
  const head = line.slice(0, space);
  return space > 0 && /^\d{4}-\d\d-\d\dT/.test(head)
    ? { time: head, text: line.slice(space + 1) }
    : { text: line };
}

export function Content() {
  const kube = useKube();
  const theme = useTheme();
  const { showToast } = useToast();
  const source = createMemoryLogSource();
  const actions = useObjectActions();
  const [following, setFollowing] = createSignal(true);
  const [loading, setLoading] = createSignal(false);

  const doc = createMemo(() =>
    docFor(kube.selectedNode(), kube.state.view, kube.state.namespace),
  );
  const docKey = createMemo(() => {
    const d = doc();
    return d.kind === "none" ? null : d.key;
  });

  async function fetchInto(key: string, args: string[]) {
    setLoading(true);
    try {
      const { stdout } = await runKubectl(kube.target, args);
      source.set(key, stdout);
    } catch (err) {
      source.set(key, errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // Describe / YAML: fetch on selection, and again whenever the object changes.
  createEffect(
    on(
      () => {
        const d = doc();
        return d.kind === "describe" || d.kind === "yaml"
          ? `${d.key}#${d.object.metadata.resourceVersion ?? ""}`
          : null;
      },
      (version) => {
        const d = doc();
        if (!version || (d.kind !== "describe" && d.kind !== "yaml")) return;
        const args = objectArgs(d.def, d.object);
        void fetchInto(
          d.key,
          d.kind === "describe"
            ? ["describe", ...args]
            : ["get", ...args, "-o", "yaml"],
        );
      },
    ),
  );

  // Kind table: kubectl's printer columns (CRDs included), refreshed as the
  // kind's watch reports changes.
  let tableTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(
      () => {
        const d = doc();
        return d.kind === "table"
          ? `${d.key}#${kube.revision(kindKey(d.def))}`
          : null;
      },
      (version, prev) => {
        const d = doc();
        if (!version || d.kind !== "table") return;
        const run = () =>
          fetchInto(d.key, [
            "get",
            resourceArg(d.def),
            ...namespaceArgs(d.def, kube.state.namespace),
          ]);
        clearTimeout(tableTimer);
        const sameTable = prev?.split("#")[0] === version.split("#")[0];
        if (sameTable)
          tableTimer = setTimeout(() => void run(), TABLE_REFRESH_MS);
        else void run();
      },
    ),
  );
  onCleanup(() => clearTimeout(tableTimer));

  // Logs: one streaming `kubectl logs -f` per selected object.
  createEffect(
    on(docKey, () => {
      const d = doc();
      if (d.kind !== "logs") return;
      source.clear(d.key);
      const ref = `${resourceArg(d.def)}/${d.object.metadata.name}`;
      const ns = d.object.metadata.namespace;
      const args = [
        "logs",
        ref,
        ...(ns ? ["-n", ns] : []),
        "--follow",
        "--timestamps",
        "--all-containers",
        "--prefix",
        `--tail=${LOG_TAIL}`,
      ];
      const proc = Bun.spawn(kubectlCommand(kube.target, args), {
        stdout: "pipe",
        stderr: "pipe",
      });
      const key = d.key;
      void (async () => {
        const decoder = new TextDecoder();
        let partial = "";
        for await (const chunk of proc.stdout) {
          const lines = (
            partial + decoder.decode(chunk, { stream: true })
          ).split("\n");
          partial = lines.pop() ?? "";
          for (const line of lines) {
            // --prefix: "[pod/name/container] <time> <text>"
            const match = /^(\[[^\]]+\]) (.*)$/.exec(line);
            const body = splitTimestamp(match ? match[2] : line);
            source.append(key, `${match ? `${match[1]} ` : ""}${body.text}\n`, {
              time: body.time,
            });
          }
        }
        const code = await proc.exited;
        if (code !== 0 && proc.signalCode === null) {
          const stderr = await new Response(proc.stderr).text();
          source.append(key, `${stderr.trim()}\n`, {
            level: "ERROR",
            time: new Date().toISOString(),
          });
        }
      })();
      onCleanup(() => proc.kill());
    }),
  );

  const [LogView, log] = LogBufferView({
    source,
    sourceKey: docKey,
    showTimestamps: () => doc().kind === "logs",
    onAutoScrollChange: setFollowing,
    onTextCopied: () => showToast("Copied to clipboard"),
  });

  // Documents read from the top; only logs follow.
  createEffect(
    on(docKey, () => {
      if (doc().kind === "logs") log.scrollToBottom();
      else setTimeout(() => log.scrollToTop(), 0);
    }),
  );

  const emptyMessage = () => {
    const d = doc();
    return d.kind === "none" ? d.message : "";
  };

  const halfPage = () => Math.floor((log.height || 20) / 2);

  let pane: Renderable | undefined;
  useScope(
    "content",
    {
      [Commands.NAV_DOWN]: () => log.scrollBy(1),
      [Commands.NAV_UP]: () => log.scrollBy(-1),
      [Commands.NAV_TOP]: () => log.scrollToTop(),
      [Commands.NAV_BOTTOM]: () => log.scrollToBottom(),
      [Commands.SCROLL_PAGEUP]: () => log.scrollBy(-halfPage()),
      [Commands.SCROLL_PAGEDOWN]: () => log.scrollBy(halfPage()),
      [Commands.SCROLL_FOLLOW]: () => log.toggleAutoScroll(),
      [Commands.VIEW_DESCRIBE]: () => kube.setView(ContentView.DESCRIBE),
      [Commands.VIEW_YAML]: () => kube.setView(ContentView.YAML),
      [Commands.VIEW_LOGS]: () => kube.setView(ContentView.LOGS),
      [Commands.SHELL_OPEN]: () => actions.shell(),
      [Commands.EDIT_OPEN]: () => actions.edit(),
      [Commands.OBJECT_DELETE]: () => actions.delete(),
      [Commands.ROLLOUT_RESTART]: () => actions.restart(),
      [Commands.OBJECT_SCALE]: () => actions.scale(),
    },
    { target: () => pane },
  );

  const title = createMemo(() => {
    const d = doc();
    switch (d.kind) {
      case "none":
        return "Describe";
      case "table":
        return `${kindLabel(d.def)} (${kube.objectsFor(kindKey(d.def))?.length ?? "…"})`;
      default: {
        const label =
          d.kind === "yaml"
            ? "YAML"
            : d.kind[0].toUpperCase() + d.kind.slice(1);
        return `${label}: ${d.def.kind.toLowerCase()}/${d.object.metadata.name}`;
      }
    }
  });

  const tags = createMemo(() => {
    const d = doc();
    const out: { text: string; color: string | undefined }[] = [];
    if (d.kind === "table" && d.def.namespaced) {
      const ns = kube.state.namespace;
      out.push({
        text: ns === ALL_NAMESPACES ? "all namespaces" : ns,
        color: theme.textMuted,
      });
    }
    if (
      (d.kind === "describe" || d.kind === "yaml" || d.kind === "logs") &&
      d.object.metadata.namespace
    ) {
      out.push({ text: d.object.metadata.namespace, color: theme.textMuted });
    }
    if (d.kind === "logs" && following())
      out.push({ text: "follow", color: theme.success });
    if (loading()) out.push({ text: "loading", color: theme.warning });
    return out;
  });

  return (
    <Pane name="content" ref={(r) => (pane = r)}>
      <PaneHeader title={title()}>
        <text flexShrink={0}>
          {tags().map((t) => (
            <span style={{ fg: t.color }}> [{t.text}]</span>
          ))}
        </text>
      </PaneHeader>
      <box marginLeft={2} flexGrow={1}>
        <Show
          when={doc().kind !== "none"}
          fallback={<text fg={theme.textMuted}>{emptyMessage()}</text>}
        >
          <LogView />
        </Show>
      </box>
      <Footer sidebarWidth={44} />
    </Pane>
  );
}
