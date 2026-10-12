export interface OwnerReference {
  kind: string;
  name: string;
  uid: string;
  controller?: boolean;
}

export interface ObjectMeta {
  name: string;
  namespace?: string;
  uid: string;
  resourceVersion?: string;
  creationTimestamp?: string;
  deletionTimestamp?: string;
  labels?: Record<string, string>;
  ownerReferences?: OwnerReference[];
}

// Only metadata is typed; spec/status vary per kind and are read through the
// narrowing helpers in status.ts.
export interface KubeObject {
  apiVersion: string;
  kind: string;
  metadata: ObjectMeta;
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

export interface KubeList {
  items: KubeObject[];
}

export const WatchEventType = {
  ADDED: "ADDED",
  MODIFIED: "MODIFIED",
  DELETED: "DELETED",
  BOOKMARK: "BOOKMARK",
  ERROR: "ERROR",
} as const;
export type WatchEventType =
  (typeof WatchEventType)[keyof typeof WatchEventType];

export interface WatchEvent {
  type: WatchEventType;
  object: KubeObject;
}

export interface KindDef {
  kind: string;
  plural: string;
  // "" for the core API group.
  group: string;
  version: string;
  namespaced: boolean;
  shortNames?: string[];
}

export function resourceArg(def: KindDef): string {
  return def.group ? `${def.plural}.${def.group}` : def.plural;
}

export function objectRef(def: KindDef, obj: KubeObject): string {
  return `${resourceArg(def)}/${obj.metadata.name}`;
}
