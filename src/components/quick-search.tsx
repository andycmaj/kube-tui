// Quick search (space): fuzzy-find any kind or object and jump to it in the
// tree. Objects come from the live watches plus a one-shot snapshot of the
// built-in kinds, so a pod is findable before Workloads is ever expanded.

import { createMemo, createResource, For, Show } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import {
  contrastingForeground,
  Modal,
  ModalCommands,
  ModalFilterInput,
  ModalHeader,
  modalNavBindings,
  truncate,
  useFocus,
  useListNavigation,
  useTheme,
} from "@andycmaj/opentui-app";
import { useKube } from "../context/kube";
import { BUILTIN_CATEGORIES } from "../kube/catalog";
import { runKubectl } from "../kube/kubectl";
import {
  kindEntry,
  kindForObject,
  objectEntry,
  rankEntries,
  SNAPSHOT_EXCLUDED,
  type SearchEntry,
} from "../kube/quick-search";
import { kindKey } from "../kube/tree";
import { resourceArg, type KubeList } from "../kube/types";
import { ALL_NAMESPACES } from "../kube/watch";

const MAX_RESULTS = 100;
const LABEL_WIDTH = 48;

const SNAPSHOT_KINDS = BUILTIN_CATEGORIES.flatMap((c) => c.kinds).filter(
  (def) => !SNAPSHOT_EXCLUDED.has(def.kind),
);

export function QuickSearch(props: { onClose: () => void }) {
  const kube = useKube();
  const theme = useTheme();
  const { setActivePane } = useFocus();
  let scrollRef: ScrollBoxRenderable | undefined;

  const [snapshot] = createResource(async () => {
    const ns = kube.state.namespace;
    const { stdout } = await runKubectl(
      kube.target,
      [
        "get",
        SNAPSHOT_KINDS.map(resourceArg).join(","),
        ...(ns === ALL_NAMESPACES ? ["--all-namespaces"] : ["-n", ns]),
        "-o",
        "json",
      ],
      { allowFailure: true },
    );
    try {
      return (JSON.parse(stdout) as KubeList).items;
    } catch {
      return [];
    }
  });

  const entries = createMemo(() => {
    const byId = new Map<string, SearchEntry>();
    const kinds = kube.allKinds();
    for (const def of kinds) {
      const entry = kindEntry(def);
      byId.set(entry.id, entry);
    }
    // Live objects win over the snapshot: they are newer.
    for (const def of kinds) {
      for (const object of kube.objectsFor(kindKey(def)) ?? []) {
        const entry = objectEntry(def, object);
        byId.set(entry.id, entry);
      }
    }
    for (const object of snapshot() ?? []) {
      const def = kindForObject(SNAPSHOT_KINDS, object);
      const entry = def && objectEntry(def, object);
      if (entry && !byId.has(entry.id)) byId.set(entry.id, entry);
    }
    return [...byId.values()];
  });

  const nav = useListNavigation({
    itemCount: () => results().length,
    scrollRef: () => scrollRef,
  });

  const results = createMemo(() =>
    rankEntries(entries(), nav.filter(), MAX_RESULTS),
  );

  function choose() {
    const entry = results()[nav.selected()];
    if (!entry) return;
    const target = entry.target;
    if (target.type === "kind") kube.revealKind(target.def);
    else kube.revealObject(target.def, target.object);
    setActivePane("tree");
    props.onClose();
  }

  function hint(entry: SearchEntry): string {
    const target = entry.target;
    if (target.type === "kind")
      return ["kind", target.def.group].filter(Boolean).join(" · ");
    return [target.def.kind, target.object.metadata.namespace]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <Modal
      onClose={props.onClose}
      size="lg"
      bindings={modalNavBindings}
      commands={{
        [ModalCommands.MODAL_SELECT]: choose,
        [ModalCommands.MODAL_DOWN]: () => nav.move(1),
        [ModalCommands.MODAL_UP]: () => nav.move(-1),
      }}
    >
      <ModalHeader
        title="Quick search"
        hint={snapshot.loading ? "loading objects…" : "po nginx = pods only"}
      />
      <ModalFilterInput
        onInput={nav.setFilter}
        placeholder="kind or object name…"
      />
      <Show
        when={results().length > 0}
        fallback={
          <box paddingLeft={2} paddingBottom={1}>
            <text fg={theme.textMuted}>No matches</text>
          </box>
        }
      >
        <scrollbox
          ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
          maxHeight={20}
          paddingBottom={1}
        >
          <For each={results()}>
            {(entry, i) => {
              const selected = () => i() === nav.selected();
              const fg = (normal: string | undefined) =>
                selected() ? contrastingForeground(theme.primary) : normal;
              return (
                <box
                  flexDirection="row"
                  paddingLeft={1}
                  paddingRight={1}
                  gap={2}
                  backgroundColor={selected() ? theme.primary : undefined}
                >
                  <text
                    fg={fg(
                      entry.target.type === "kind" ? theme.accent : theme.text,
                    )}
                    attributes={selected() ? 1 : 0}
                    flexGrow={1}
                    wrapMode="none"
                  >
                    {truncate(entry.label, LABEL_WIDTH)}
                  </text>
                  <text fg={fg(theme.textMuted)} flexShrink={0}>
                    {hint(entry)}
                  </text>
                </box>
              );
            }}
          </For>
        </scrollbox>
      </Show>
    </Modal>
  );
}
