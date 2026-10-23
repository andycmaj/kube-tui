// Actions on the selected tree object, shared by the tree and content scopes.

import { makeGuard, useFocus, useToast } from "@andycmaj/opentui-app";
import { useDialog } from "../context/dialog";
import { useKube } from "../context/kube";
import { useTerminal } from "../context/terminal";
import { kubectlCommand, runKubectl } from "../kube/kubectl";
import { podContainers } from "../kube/logs";
import { resourceArg, type KubeObject } from "../kube/types";

const RESTARTABLE = new Set(["Deployment", "StatefulSet", "DaemonSet"]);
const SCALABLE = new Set(["Deployment", "StatefulSet", "ReplicaSet"]);

const EXECABLE = new Set([
  "Pod",
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "ReplicaSet",
  "Job",
]);

// Prefer bash, fall back to sh, like k9s.
const SHELL = [
  "sh",
  "-c",
  "command -v bash >/dev/null 2>&1 && exec bash || exec sh",
];

export function useObjectActions() {
  const kube = useKube();
  const terminal = useTerminal();
  const { setActivePane } = useFocus();
  const { showToast } = useToast();
  const dialog = useDialog();
  const guard = makeGuard(showToast);

  async function mutate(label: string, args: string[], done: string) {
    const ok = await guard(label, async () => {
      await runKubectl(kube.target, args);
    });
    if (ok) showToast(done);
  }

  function selectedObject() {
    const node = kube.selectedNode();
    return node?.type === "object" ? node : undefined;
  }

  function nsArgs(obj: KubeObject): string[] {
    return obj.metadata.namespace ? ["-n", obj.metadata.namespace] : [];
  }

  return {
    shell(): boolean {
      const node = selectedObject();
      if (!node) return false;
      if (!EXECABLE.has(node.def.kind)) {
        showToast(`Can't open a shell in a ${node.def.kind}`, 3000, "error");
        return true;
      }
      const container = podContainers(node.object)[0];
      const ref =
        node.def.kind === "Pod"
          ? node.object.metadata.name
          : `${resourceArg(node.def)}/${node.object.metadata.name}`;
      terminal.open({
        title: `Shell: ${node.def.kind.toLowerCase()}/${node.object.metadata.name}`,
        tag: container,
        command: kubectlCommand(kube.target, [
          "exec",
          "-it",
          ref,
          ...nsArgs(node.object),
          ...(container ? ["-c", container] : []),
          "--",
          ...SHELL,
        ]),
      });
      setActivePane("content");
      return true;
    },
    edit(): boolean {
      const node = selectedObject();
      if (!node) return false;
      terminal.open({
        title: `Edit: ${node.def.kind.toLowerCase()}/${node.object.metadata.name}`,
        tag: node.object.metadata.namespace,
        command: kubectlCommand(kube.target, [
          "edit",
          resourceArg(node.def),
          node.object.metadata.name,
          ...nsArgs(node.object),
        ]),
      });
      setActivePane("content");
      return true;
    },
    delete(): boolean {
      const node = selectedObject();
      if (!node) return false;
      const { name, namespace } = node.object.metadata;
      const ref = `${node.def.kind.toLowerCase()}/${name}`;
      dialog.open({
        kind: "confirm",
        title: `Delete ${ref}?`,
        detail: namespace ? `namespace ${namespace}` : undefined,
        confirmLabel: "delete",
        run: () =>
          mutate(
            "Delete",
            [
              "delete",
              resourceArg(node.def),
              name,
              ...nsArgs(node.object),
              "--wait=false",
            ],
            `Deleted ${ref}`,
          ),
      });
      return true;
    },
    restart(): boolean {
      const node = selectedObject();
      if (!node || !RESTARTABLE.has(node.def.kind)) return false;
      const ref = `${resourceArg(node.def)}/${node.object.metadata.name}`;
      dialog.open({
        kind: "confirm",
        title: `Restart ${node.def.kind.toLowerCase()}/${node.object.metadata.name}?`,
        detail: "kubectl rollout restart",
        confirmLabel: "restart",
        run: () =>
          mutate(
            "Restart",
            ["rollout", "restart", ref, ...nsArgs(node.object)],
            `Restarted ${ref}`,
          ),
      });
      return true;
    },
    scale(): boolean {
      const node = selectedObject();
      if (!node || !SCALABLE.has(node.def.kind)) return false;
      const ref = `${resourceArg(node.def)}/${node.object.metadata.name}`;
      const current = node.object.spec?.replicas;
      dialog.open({
        kind: "prompt",
        title: `Scale ${node.def.kind.toLowerCase()}/${node.object.metadata.name}`,
        detail: "replicas",
        initial: typeof current === "number" ? String(current) : "1",
        run: async (value) => {
          const replicas = Number.parseInt(value, 10);
          if (!Number.isInteger(replicas) || replicas < 0) {
            showToast(`Invalid replica count: ${value}`, 3000, "error");
            return;
          }
          await mutate(
            "Scale",
            ["scale", ref, `--replicas=${replicas}`, ...nsArgs(node.object)],
            `Scaled ${ref} to ${replicas}`,
          );
        },
      });
      return true;
    },
  };
}
