import { WatchEventType, type KubeObject, type WatchEvent } from "./types";

export type ObjectMap = Record<string, KubeObject>;

// Returns the next map, or the same map when the event changes nothing.
export function applyWatchEvent(
  objects: ObjectMap,
  event: WatchEvent,
): ObjectMap {
  const uid = event.object?.metadata?.uid;
  switch (event.type) {
    case WatchEventType.ADDED:
    case WatchEventType.MODIFIED:
      if (!uid) return objects;
      return { ...objects, [uid]: event.object };
    case WatchEventType.DELETED: {
      if (!uid || !(uid in objects)) return objects;
      const { [uid]: _removed, ...rest } = objects;
      return rest;
    }
    default:
      return objects;
  }
}

export function sortObjects(objects: ObjectMap): KubeObject[] {
  return Object.values(objects).sort(
    (a, b) =>
      (a.metadata.namespace ?? "").localeCompare(b.metadata.namespace ?? "") ||
      a.metadata.name.localeCompare(b.metadata.name),
  );
}
