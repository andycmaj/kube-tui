// The built-in API kinds, grouped the way Lens groups them. Rendered
// immediately at startup; custom resources are discovered asynchronously.

import type { KindDef } from "./types";

export interface Category {
  id: string;
  title: string;
  kinds: KindDef[];
}

const core = (
  kind: string,
  plural: string,
  namespaced: boolean,
  shortNames?: string[],
): KindDef => ({
  kind,
  plural,
  group: "",
  version: "v1",
  namespaced,
  shortNames,
});

const grouped = (
  group: string,
  version: string,
  kind: string,
  plural: string,
  namespaced: boolean,
  shortNames?: string[],
): KindDef => ({ kind, plural, group, version, namespaced, shortNames });

const RBAC = "rbac.authorization.k8s.io";

export const BUILTIN_CATEGORIES: Category[] = [
  {
    id: "cluster",
    title: "Cluster",
    kinds: [
      core("Node", "nodes", false, ["no"]),
      core("Namespace", "namespaces", false, ["ns"]),
      core("Event", "events", true, ["ev"]),
    ],
  },
  {
    id: "workloads",
    title: "Workloads",
    kinds: [
      core("Pod", "pods", true, ["po"]),
      grouped("apps", "v1", "Deployment", "deployments", true, ["deploy"]),
      grouped("apps", "v1", "StatefulSet", "statefulsets", true, ["sts"]),
      grouped("apps", "v1", "DaemonSet", "daemonsets", true, ["ds"]),
      grouped("apps", "v1", "ReplicaSet", "replicasets", true, ["rs"]),
      grouped("batch", "v1", "Job", "jobs", true),
      grouped("batch", "v1", "CronJob", "cronjobs", true, ["cj"]),
    ],
  },
  {
    id: "config",
    title: "Config",
    kinds: [
      core("ConfigMap", "configmaps", true, ["cm"]),
      core("Secret", "secrets", true),
      core("ResourceQuota", "resourcequotas", true, ["quota"]),
      core("LimitRange", "limitranges", true, ["limits"]),
      grouped(
        "autoscaling",
        "v2",
        "HorizontalPodAutoscaler",
        "horizontalpodautoscalers",
        true,
        ["hpa"],
      ),
      grouped(
        "policy",
        "v1",
        "PodDisruptionBudget",
        "poddisruptionbudgets",
        true,
        ["pdb"],
      ),
    ],
  },
  {
    id: "network",
    title: "Network",
    kinds: [
      core("Service", "services", true, ["svc"]),
      core("Endpoints", "endpoints", true, ["ep"]),
      grouped("networking.k8s.io", "v1", "Ingress", "ingresses", true, ["ing"]),
      grouped(
        "networking.k8s.io",
        "v1",
        "IngressClass",
        "ingressclasses",
        false,
      ),
      grouped(
        "networking.k8s.io",
        "v1",
        "NetworkPolicy",
        "networkpolicies",
        true,
        ["netpol"],
      ),
    ],
  },
  {
    id: "storage",
    title: "Storage",
    kinds: [
      core("PersistentVolumeClaim", "persistentvolumeclaims", true, ["pvc"]),
      core("PersistentVolume", "persistentvolumes", false, ["pv"]),
      grouped("storage.k8s.io", "v1", "StorageClass", "storageclasses", false, [
        "sc",
      ]),
    ],
  },
  {
    id: "access",
    title: "Access Control",
    kinds: [
      core("ServiceAccount", "serviceaccounts", true, ["sa"]),
      grouped(RBAC, "v1", "Role", "roles", true),
      grouped(RBAC, "v1", "RoleBinding", "rolebindings", true),
      grouped(RBAC, "v1", "ClusterRole", "clusterroles", false),
      grouped(RBAC, "v1", "ClusterRoleBinding", "clusterrolebindings", false),
    ],
  },
];

// "Pods", "Ingresses", "NetworkPolicies": the kind pluralised for display,
// using the API's lower-case plural for the suffix.
export function kindLabel(def: KindDef): string {
  const lower = def.kind.toLowerCase();
  if (def.plural === lower) return def.kind;
  if (def.plural.startsWith(lower))
    return def.kind + def.plural.slice(lower.length);
  if (lower.endsWith("y") && def.plural === `${lower.slice(0, -1)}ies`) {
    return `${def.kind.slice(0, -1)}ies`;
  }
  return def.kind;
}
