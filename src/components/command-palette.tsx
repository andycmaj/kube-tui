// Command palette: every kind (k9s-style `:pods` jumps) plus the keybound
// commands reachable from the active pane, rendered by the framework's
// CommandPalette.

import { createMemo } from "solid-js";
import {
  CommandPalette,
  useFocus,
  useKeymap,
  useReachableBindings,
  type PaletteAction,
} from "@andycmaj/opentui-app";
import { useKube } from "../context/kube";
import { kindLabel } from "../kube/catalog";
import { kindKey } from "../kube/tree";

export function KubeCommandPalette(props: { onClose: () => void }) {
  const kube = useKube();
  const keymap = useKeymap();
  const { activePaneTarget, setActivePane } = useFocus();
  const bindings = useReachableBindings();

  const actions = createMemo(() => {
    const result: PaletteAction[] = kube.allKinds().map((def) => ({
      id: `kind:${kindKey(def)}`,
      label: kindLabel(def),
      hint: [def.plural, ...(def.shortNames ?? []), def.group]
        .filter(Boolean)
        .join(" · "),
      group: "Resources",
      run: () => {
        kube.revealKind(def);
        setActivePane("tree");
      },
    }));

    // Dispatch against the active pane: the palette's own modal holds focus.
    const seen = new Set<string>();
    for (const binding of bindings()) {
      if (!binding.help || seen.has(binding.cmd)) continue;
      seen.add(binding.cmd);
      result.push({
        id: `command:${binding.cmd}`,
        label: binding.desc,
        hint: binding.keys,
        group: "Commands",
        run: () => {
          keymap.dispatchCommand(binding.cmd, { focused: activePaneTarget() });
        },
      });
    }
    return result;
  });

  return <CommandPalette actions={actions()} onClose={props.onClose} />;
}
