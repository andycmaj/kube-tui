// Cluster state: the tree's expansion/selection, CRD discovery, and one
// kubectl watch per expanded kind. Watches start when a kind is expanded and
// halt when it is collapsed or the namespace changes, so a fully collapsed
// tree costs nothing.

import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type ParentProps,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { run, sleep, type Operation, type Task } from "effection";
import { createRequiredContext, errorMessage } from "@andycmaj/opentui-app";
import { BUILTIN_CATEGORIES } from "../kube/catalog";
import { customGroupsFromCrds, type CustomGroup } from "../kube/discovery";
import { runKubectl, runKubectlJson, type KubeTarget } from "../kube/kubectl";
import {
  buildTree,
  CUSTOM_CATEGORY_ID,
  kindKey,
  type TreeNode,
} from "../kube/tree";
import type { KindDef, KubeList, KubeObject, WatchEvent } from "../kube/types";
import { ALL_NAMESPACES, watchKind } from "../kube/watch";
import {
  applyWatchEvent,
  sortObjects,
  type ObjectMap,
} from "../kube/watch-reducer";

export type WatchStatus = "connecting" | "live" | "error";

export const ContentView = {
  DESCRIBE: "describe",
  YAML: "yaml",
  LOGS: "logs",
} as const;
export type ContentView = (typeof ContentView)[keyof typeof ContentView];

interface KubeState {
  context: string | null;
  namespace: string;
  customGroups: CustomGroup[] | null;
  discoveryError: string | null;
  expanded: Record<string, boolean>;
  selectedId: string | null;
  view: ContentView;
  watchStatus: Record<string, WatchStatus>;
  watchError: Record<string, string>;
}

interface KubeContextValue {
  target: KubeTarget;
  state: KubeState;
  nodes: () => TreeNode[];
  selectedNode: () => TreeNode | undefined;
  objectsFor: (key: string) => KubeObject[] | undefined;
  // Bumps whenever an object of the given kind changes; for re-fetching docs.
  revision: (key: string) => number;
  select: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  collapseAll: () => void;
  setNamespace: (namespace: string) => void;
  setView: (view: ContentView) => void;
  allKinds: () => KindDef[];
  // Expand the path to a kind, start its watch, and select it.
  revealKind: (def: KindDef) => void;
}

const [KubeContext, useKube] = createRequiredContext<KubeContextValue>("Kube");
export { useKube };

const FLUSH_MS = 50;
const RETRY_MS = 3000;

export function KubeProvider(
  props: ParentProps<{ target: KubeTarget; namespace?: string }>,
) {
  const target = props.target;
  const [state, setState] = createStore<KubeState>({
    context: target.context ?? null,
    namespace: props.namespace ?? ALL_NAMESPACES,
    customGroups: null,
    discoveryError: null,
    expanded: {},
    selectedId: null,
    view: ContentView.DESCRIBE,
    watchStatus: {},
    watchError: {},
  });

  // Object maps live outside the store: replacing whole maps per flush is
  // simpler than reconciling deletes into a store path.
  const [objects, setObjects] = createSignal<Record<string, ObjectMap>>({});
  const [revisions, setRevisions] = createSignal<Record<string, number>>({});

  const kindsByKey = createMemo(() => {
    const map = new Map<string, KindDef>();
    for (const cat of BUILTIN_CATEGORIES)
      for (const def of cat.kinds) map.set(kindKey(def), def);
    for (const group of state.customGroups ?? [])
      for (const def of group.kinds) map.set(kindKey(def), def);
    return map;
  });

  const sortedObjects = createMemo(() => {
    const out: Record<string, KubeObject[]> = {};
    for (const [key, map] of Object.entries(objects()))
      out[key] = sortObjects(map);
    return out;
  });

  const nodes = createMemo(() =>
    buildTree({
      categories: BUILTIN_CATEGORIES,
      customGroups: state.customGroups,
      expanded: state.expanded,
      objects: sortedObjects(),
    }),
  );

  const selectedNode = createMemo(() =>
    nodes().find((n) => n.id === state.selectedId),
  );

  // Watch events arrive in bursts (a full list on start); apply them in batches.
  let pending: { key: string; event: WatchEvent }[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  function enqueue(key: string, event: WatchEvent) {
    pending.push({ key, event });
    flushTimer ??= setTimeout(flush, FLUSH_MS);
  }
  function flush() {
    flushTimer = undefined;
    const events = pending;
    pending = [];
    batch(() => {
      setObjects((prev) => {
        const next = { ...prev };
        for (const { key, event } of events)
          next[key] = applyWatchEvent(next[key] ?? {}, event);
        return next;
      });
      setRevisions((prev) => {
        const next = { ...prev };
        for (const { key } of events) next[key] = (next[key] ?? 0) + 1;
        return next;
      });
      for (const key of new Set(events.map((e) => e.key)))
        setState("watchStatus", key, "live");
    });
  }

  function* watchLoop(def: KindDef, namespace: string): Operation<void> {
    const key = kindKey(def);
    while (true) {
      setState("watchStatus", key, "connecting");
      // Every (re)start replays the full list as ADDED events; start fresh so
      // objects deleted while disconnected don't linger.
      setObjects((prev) => ({ ...prev, [key]: {} }));
      try {
        yield* watchKind(target, def, namespace, (event) =>
          enqueue(key, event),
        );
      } catch (err) {
        setState("watchStatus", key, "error");
        setState("watchError", key, errorMessage(err));
      }
      yield* sleep(RETRY_MS);
    }
  }

  const tasks = new Map<string, Task<void>>();
  function stopWatch(key: string) {
    const task = tasks.get(key);
    if (!task) return;
    tasks.delete(key);
    void task.halt();
    setObjects((prev) => {
      const { [key]: _gone, ...rest } = prev;
      return rest;
    });
  }

  // Run exactly the watches for expanded kinds in the current namespace.
  createEffect(() => {
    const namespace = state.namespace;
    const wanted = new Map<string, KindDef>();
    for (const [id, open] of Object.entries(state.expanded)) {
      if (!open || !id.startsWith("kind:")) continue;
      const def = kindsByKey().get(id.slice("kind:".length));
      if (def) wanted.set(`${kindKey(def)}@${namespace}`, def);
    }
    for (const taskKey of [...tasks.keys()]) {
      if (!wanted.has(taskKey)) stopWatch(taskKey.split("@")[0]);
    }
    for (const [taskKey, def] of wanted) {
      if (!tasks.has(taskKey))
        tasks.set(
          taskKey,
          run(() => watchLoop(def, namespace)),
        );
    }
  });

  onMount(async () => {
    if (!state.context) {
      try {
        const { stdout } = await runKubectl(target, [
          "config",
          "current-context",
        ]);
        setState("context", stdout.trim());
      } catch (err) {
        console.error("current-context:", errorMessage(err));
      }
    }
    try {
      const crds = await runKubectlJson<KubeList>(target, [
        "get",
        "customresourcedefinitions",
      ]);
      setState("customGroups", customGroupsFromCrds(crds.items));
    } catch (err) {
      setState("discoveryError", errorMessage(err));
      setState("customGroups", []);
    }
  });

  onCleanup(() => {
    clearTimeout(flushTimer);
    for (const task of tasks.values()) void task.halt();
    tasks.clear();
  });

  const value: KubeContextValue = {
    target,
    state,
    nodes,
    selectedNode,
    objectsFor: (key) => sortedObjects()[key],
    revision: (key) => revisions()[key] ?? 0,
    select: (id) => setState("selectedId", id),
    setExpanded: (id, expanded) => setState("expanded", id, expanded),
    collapseAll: () => setState("expanded", reconcile({})),
    setNamespace: (namespace) => setState("namespace", namespace),
    setView: (view) => setState("view", view),
    allKinds: () => [...kindsByKey().values()],
    revealKind: (def) => {
      const key = kindKey(def);
      const category = BUILTIN_CATEGORIES.find((c) =>
        c.kinds.some((k) => kindKey(k) === key),
      );
      batch(() => {
        if (category) {
          setState("expanded", `cat:${category.id}`, true);
        } else {
          setState("expanded", CUSTOM_CATEGORY_ID, true);
          setState("expanded", `grp:${def.group}`, true);
        }
        setState("expanded", `kind:${key}`, true);
        setState("selectedId", `kind:${key}`);
      });
    },
  };

  return (
    <KubeContext.Provider value={value}>{props.children}</KubeContext.Provider>
  );
}
