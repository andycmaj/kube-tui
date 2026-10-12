// Main App component: the provider stack, the tree + content layout, and the
// app-level modals (rendered outside the panes so their keys stay isolated).

import { Show } from "solid-js";
import type { Renderable } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import {
  FocusProvider,
  KeyboardHelp,
  KeymapProvider,
  ThemeProvider,
  Toast,
  ToastProvider,
  useFocus,
  useScope,
  useTheme,
} from "@andycmaj/opentui-app";
import { KubeProvider } from "./context/kube";
import { Tree } from "./components/tree";
import { Content } from "./components/content";
import { NamespacePicker } from "./components/namespace-picker";
import { KubeCommandPalette } from "./components/command-palette";
import { Commands } from "./commands";
import { keymap, PANES } from "./keymap";
import type { KubeTarget } from "./kube/kubectl";

function AppContent() {
  const renderer = useRenderer();
  const {
    cyclePane,
    sidebarVisible,
    toggleSidebar,
    activeModal,
    openModal,
    closeModal,
  } = useFocus();
  const theme = useTheme();

  let layout: Renderable | undefined;
  useScope(
    "app",
    {
      [Commands.APP_QUIT]: () => {
        renderer.destroy();
        process.exit(0);
      },
      [Commands.SIDEBAR_TOGGLE]: toggleSidebar,
      [Commands.FOCUS_NEXT]: cyclePane,
      [Commands.PALETTE_OPEN]: () => openModal("palette"),
      [Commands.HELP_OPEN]: () => openModal("help"),
      [Commands.NAMESPACE_PICK]: () => openModal("namespace"),
    },
    { target: () => layout },
  );

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.background}
    >
      <box
        ref={(r: Renderable) => (layout = r)}
        flexDirection="row"
        flexGrow={1}
      >
        <Show when={sidebarVisible()}>
          <Tree />
        </Show>
        <Content />
      </box>

      <Show when={activeModal() === "palette"}>
        <KubeCommandPalette onClose={closeModal} />
      </Show>
      <Show when={activeModal() === "help"}>
        <KeyboardHelp
          onClose={closeModal}
          scopeLabels={{ app: "Global", tree: "Resources", content: "Content" }}
          scopeOrder={["app", "tree", "content"]}
        />
      </Show>
      <Show when={activeModal() === "namespace"}>
        <NamespacePicker onClose={closeModal} />
      </Show>
    </box>
  );
}

export function App(props: { target: KubeTarget; namespace?: string }) {
  return (
    <ThemeProvider>
      <KubeProvider target={props.target} namespace={props.namespace}>
        <FocusProvider panes={PANES}>
          <ToastProvider>
            <KeymapProvider keymap={keymap}>
              <AppContent />
              <Toast />
            </KeymapProvider>
          </ToastProvider>
        </FocusProvider>
      </KubeProvider>
    </ThemeProvider>
  );
}
