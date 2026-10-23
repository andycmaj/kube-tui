// Pick which container the logs view streams, or all of them.

import { createMemo, For } from "solid-js";
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
import { podContainers } from "../kube/logs";

const ALL = "all containers";

export function ContainerPicker(props: { onClose: () => void }) {
  const kube = useKube();
  const theme = useTheme();
  let scrollRef: ScrollBoxRenderable | undefined;

  const object = () => {
    const node = kube.selectedNode();
    return node?.type === "object" ? node.object : undefined;
  };
  const current = () => {
    const o = object();
    return (o && kube.state.logContainer[o.metadata.uid]) ?? null;
  };

  const nav = useListNavigation({
    itemCount: () => options().length,
    scrollRef: () => scrollRef,
  });

  const options = createMemo(() => {
    const o = object();
    const all = [ALL, ...(o ? podContainers(o) : [])];
    const needle = nav.filter().toLowerCase();
    return needle ? all.filter((c) => c.toLowerCase().includes(needle)) : all;
  });

  function choose() {
    const o = object();
    const choice = options()[nav.selected()];
    if (o && choice)
      kube.setLogContainer(o.metadata.uid, choice === ALL ? null : choice);
    props.onClose();
  }

  return (
    <Modal
      onClose={props.onClose}
      size="sm"
      bindings={modalNavBindings}
      commands={{
        [ModalCommands.MODAL_SELECT]: choose,
        [ModalCommands.MODAL_DOWN]: () => nav.move(1),
        [ModalCommands.MODAL_UP]: () => nav.move(-1),
      }}
    >
      <ModalHeader title="Log container" />
      <ModalFilterInput onInput={nav.setFilter} />
      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
        maxHeight={15}
        paddingBottom={1}
      >
        <For each={options()}>
          {(name, i) => {
            const selected = () => i() === nav.selected();
            const active = () => (current() ?? ALL) === name;
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
                  {active() ? "● " : "  "}
                  {name}
                </text>
              </box>
            );
          }}
        </For>
      </scrollbox>
    </Modal>
  );
}
