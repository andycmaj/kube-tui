// Namespace picker modal: fuzzy-filtered list of the cluster's namespaces.

import { createMemo, createResource, For, Show } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import {
  contrastingForeground,
  Modal,
  ModalCommands,
  ModalFilterInput,
  ModalHeader,
  modalNavBindings,
  useListNavigation,
  useTheme,
} from "@andycmaj/opentui-app";
import { useKube } from "../context/kube";
import { runKubectl } from "../kube/kubectl";
import { ALL_NAMESPACES } from "../kube/watch";

export function NamespacePicker(props: { onClose: () => void }) {
  const kube = useKube();
  const theme = useTheme();
  let scrollRef: ScrollBoxRenderable | undefined;

  const [namespaces] = createResource(async () => {
    const { stdout } = await runKubectl(kube.target, [
      "get",
      "namespaces",
      "-o",
      "name",
    ]);
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((n) => n.replace(/^namespace\//, ""));
  });

  const nav = useListNavigation({
    itemCount: () => options().length,
    scrollRef: () => scrollRef,
  });

  const options = createMemo(() => {
    const needle = nav.filter().toLowerCase();
    const all = [ALL_NAMESPACES, ...(namespaces() ?? [])];
    return needle ? all.filter((n) => n.toLowerCase().includes(needle)) : all;
  });

  function choose() {
    const ns = options()[nav.selected()];
    if (ns) kube.setNamespace(ns);
    props.onClose();
  }

  return (
    <Modal
      onClose={props.onClose}
      size="md"
      bindings={modalNavBindings}
      commands={{
        [ModalCommands.MODAL_SELECT]: choose,
        [ModalCommands.MODAL_DOWN]: () => nav.move(1),
        [ModalCommands.MODAL_UP]: () => nav.move(-1),
      }}
    >
      <ModalHeader title="Namespace" />
      <ModalFilterInput onInput={nav.setFilter} />
      <scrollbox ref={(r: ScrollBoxRenderable) => (scrollRef = r)} flexGrow={1}>
        <Show
          when={!namespaces.loading}
          fallback={<text fg={theme.textMuted}>loading…</text>}
        >
          <For each={options()}>
            {(ns, i) => {
              const selected = () => i() === nav.selected();
              return (
                <box
                  paddingLeft={1}
                  backgroundColor={selected() ? theme.primary : undefined}
                >
                  <text
                    fg={
                      selected()
                        ? contrastingForeground(theme.primary)
                        : theme.text
                    }
                  >
                    {ns === kube.state.namespace ? "● " : "  "}
                    {ns}
                  </text>
                </box>
              );
            }}
          </For>
        </Show>
      </scrollbox>
    </Modal>
  );
}
