// Context + namespace status at the bottom of the sidebar, like tilt-tui's
// connection status.

import { StatusIndicator, useTheme } from "@andycmaj/opentui-app";
import { useKube } from "../context/kube";
import { ALL_NAMESPACES } from "../kube/watch";

export function SidebarStatus() {
  const kube = useKube();
  const theme = useTheme();
  const watching = () => Object.values(kube.state.watchStatus);
  const color = () =>
    watching().includes("error")
      ? theme.error
      : watching().includes("connecting")
        ? theme.warning
        : theme.success;
  const ns = () =>
    kube.state.namespace === ALL_NAMESPACES
      ? "all namespaces"
      : kube.state.namespace;

  return (
    <StatusIndicator
      narrow
      status={`● ${kube.state.context ?? "…"}`}
      statusColor={color()}
      subtitle={`ns: ${ns()}`}
      right={
        kube.state.discoveryError
          ? `CRDs: ${kube.state.discoveryError.slice(0, 60)}`
          : undefined
      }
      rightIsError
    />
  );
}
