// Which objects have logs, their containers, and the `kubectl logs` stream
// for one container or all of them.

import { resourceArg, type KindDef, type KubeObject } from "./types";

const LOGGABLE = new Set([
  "Pod",
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "ReplicaSet",
  "Job",
]);
const LOG_TAIL = 500;

export function isLoggable(def: KindDef): boolean {
  return LOGGABLE.has(def.kind);
}

function names(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((c: unknown) =>
    typeof c === "object" &&
    c !== null &&
    "name" in c &&
    typeof c.name === "string"
      ? [c.name]
      : [],
  );
}

// A pod's own spec, or a workload's pod template. Init containers last: they
// have usually exited, so they are rarely the one you want.
export function podContainers(object: KubeObject): string[] {
  const spec = object.spec ?? {};
  const template = spec.template;
  const podSpec =
    object.kind === "Pod"
      ? spec
      : typeof template === "object" && template !== null && "spec" in template
        ? template.spec
        : undefined;
  if (typeof podSpec !== "object" || podSpec === null) return [];
  return [
    ...names("containers" in podSpec ? podSpec.containers : undefined),
    ...names("initContainers" in podSpec ? podSpec.initContainers : undefined),
  ];
}

// null streams every container, prefixed so lines can be told apart.
export function logArgs(
  def: KindDef,
  object: KubeObject,
  container: string | null,
): string[] {
  const ns = object.metadata.namespace;
  return [
    "logs",
    `${resourceArg(def)}/${object.metadata.name}`,
    ...(ns ? ["-n", ns] : []),
    "--follow",
    "--timestamps",
    `--tail=${LOG_TAIL}`,
    ...(container ? ["-c", container] : ["--all-containers", "--prefix"]),
  ];
}
