// Renders the pending DialogRequest: return confirms, escape cancels.

import { createSignal, Show } from "solid-js";
import {
  Modal,
  ModalFilterInput,
  ModalHeader,
  useTheme,
} from "@andycmaj/opentui-app";
import { useDialog } from "../context/dialog";

const CONFIRM = "dialog.confirm";

export function Dialog() {
  const dialog = useDialog();
  const theme = useTheme();
  const [value, setValue] = createSignal("");
  const req = () => dialog.request();

  function confirm() {
    const r = req();
    if (!r) return;
    dialog.close();
    void (r.kind === "confirm" ? r.run() : r.run(value() || r.initial));
  }

  return (
    <Show when={req()}>
      <Modal
        size="sm"
        onClose={dialog.close}
        bindings={[{ key: "return", cmd: CONFIRM, desc: "confirm" }]}
        commands={{ [CONFIRM]: confirm }}
      >
        <ModalHeader title={req()?.title ?? ""} />
        <box paddingLeft={2} paddingRight={2} flexDirection="column">
          <Show when={req()?.detail}>
            <text fg={theme.textMuted}>{req()?.detail}</text>
          </Show>
          <Show when={req()?.kind === "prompt"}>
            <ModalFilterInput
              onInput={setValue}
              initialValue={(() => {
                const r = req();
                return r?.kind === "prompt" ? r.initial : "";
              })()}
            />
          </Show>
          <text>
            <span style={{ fg: theme.primary }}>↵</span>
            <span style={{ fg: theme.textMuted }}>
              {" "}
              {(() => {
                const r = req();
                return r?.kind === "confirm" ? r.confirmLabel : "apply";
              })()}{" "}
              ·{" "}
            </span>
            <span style={{ fg: theme.primary }}>esc</span>
            <span style={{ fg: theme.textMuted }}> cancel</span>
          </text>
        </box>
      </Modal>
    </Show>
  );
}
