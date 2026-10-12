// Custom resource discovery from the cluster's CRDs: one `kubectl get crd`
// call, grouped by API group for the tree's "Custom Resources" section.

import type { KindDef, KubeObject } from "./types";

export interface CustomGroup {
  group: string;
  kinds: KindDef[];
}

interface CrdVersion {
  name: string;
  served?: boolean;
  storage?: boolean;
}

interface CrdSpec {
  group: string;
  scope: "Namespaced" | "Cluster";
  names: { kind: string; plural: string; shortNames?: string[] };
  versions: CrdVersion[];
}

function isCrdSpec(spec: unknown): spec is CrdSpec {
  if (typeof spec !== "object" || spec === null) return false;
  return "group" in spec && "names" in spec && "versions" in spec;
}

function preferredVersion(versions: CrdVersion[]): string | undefined {
  const served = versions.filter((v) => v.served !== false);
  return (served.find((v) => v.storage) ?? served[0])?.name;
}

export function customGroupsFromCrds(crds: KubeObject[]): CustomGroup[] {
  const groups = new Map<string, KindDef[]>();
  for (const crd of crds) {
    const spec: unknown = crd.spec;
    if (!isCrdSpec(spec)) continue;
    const version = preferredVersion(spec.versions);
    if (!version) continue;
    const kinds = groups.get(spec.group) ?? [];
    kinds.push({
      kind: spec.names.kind,
      plural: spec.names.plural,
      group: spec.group,
      version,
      namespaced: spec.scope === "Namespaced",
      shortNames: spec.names.shortNames,
    });
    groups.set(spec.group, kinds);
  }
  return [...groups.entries()]
    .map(([group, kinds]) => ({
      group,
      kinds: kinds.sort((a, b) => a.kind.localeCompare(b.kind)),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));
}
