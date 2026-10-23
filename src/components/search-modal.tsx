// Find in the content pane: a substring or /regex/ applied to whatever the
// pane shows (logs, describe, YAML, tables). Matching lines only, highlighted.

import { createSignal, Show } from "solid-js";
import {
  Modal,
  ModalCommands,
  ModalFilterInput,
  ModalHeader,
  useTheme,
  type BindingSpec,
  type LogSearchFilter,
} from "@andycmaj/opentui-app";
import { parseSearchQuery } from "../search";

const SUBMIT: BindingSpec = {
  key: "return",
  cmd: ModalCommands.MODAL_SELECT,
  desc: "find",
};

export function SearchModal(props: {
  initialQuery: string;
  onSearch: (filter: LogSearchFilter | null) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = createSignal(props.initialQuery);
  const [error, setError] = createSignal<string | null>(null);

  function submit() {
    const filter = parseSearchQuery(query());
    if (filter?.isRegex && !filter.regex) {
      setError("Invalid regex");
      return;
    }
    props.onSearch(filter);
    props.onClose();
  }

  return (
    <Modal
      size="sm"
      onClose={props.onClose}
      bindings={[SUBMIT]}
      commands={{ [ModalCommands.MODAL_SELECT]: submit }}
    >
      <ModalHeader title="Find" hint="/regex/ for regex" />
      <ModalFilterInput
        initialValue={props.initialQuery}
        placeholder="text or /regex/…"
        onInput={(v) => {
          setQuery(v);
          setError(null);
        }}
      />
      <Show when={error()}>
        <box paddingLeft={2} paddingBottom={1}>
          <text fg={theme.error}>{error()}</text>
        </box>
      </Show>
    </Modal>
  );
}
