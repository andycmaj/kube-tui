// Per-kind one-glance summaries for tree rows: a health colour, a short
// readiness string for line 1, and detail parts for line 2.

import type { KindDef, KubeObject } from "./types";

export const Health = {
  OK: "ok",
  PENDING: "pending",
  WARN: "warn",
  ERROR: "error",
  NEUTRAL: "neutral",
} as const;
export type Health = (typeof Health)[keyof typeof Health];

export interface Summary {
  health: Health;
  ready?: string;
  details: string[];
}

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function rec(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function formatAge(
  timestamp: string | undefined,
  now = Date.now(),
): string {
  if (!timestamp) return "";
  const s = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 365 ? `${d}d` : `${Math.floor(d / 365)}y`;
}

const WAITING_ERRORS = new Set([
  "CrashLoopBackOff",
  "ImagePullBackOff",
  "ErrImagePull",
  "CreateContainerConfigError",
  "InvalidImageName",
  "RunContainerError",
]);

export function summarizePod(pod: KubeObject): Summary {
  const status = rec(pod.status);
  const statuses = arr(status.containerStatuses).map(rec);
  const total = arr(rec(pod.spec).containers).length;
  const ready = statuses.filter((c) => c.ready === true).length;
  const restarts = statuses.reduce((n, c) => n + num(c.restartCount), 0);
  const phase = str(status.phase) ?? "Unknown";

  // The most specific reason wins, like kubectl's STATUS column.
  let reason = str(status.reason) ?? phase;
  for (const c of arr(status.initContainerStatuses).map(rec)) {
    const waiting = str(rec(rec(c.state).waiting).reason);
    if (c.ready !== true && waiting) {
      reason = `Init:${waiting}`;
      break;
    }
  }
  for (const c of statuses) {
    const state = rec(c.state);
    const waiting = str(rec(state.waiting).reason);
    const terminated = str(rec(state.terminated).reason);
    if (waiting) reason = waiting;
    else if (terminated && phase !== "Succeeded") reason = terminated;
  }
  if (pod.metadata.deletionTimestamp) reason = "Terminating";

  let health: Health;
  if (phase === "Succeeded") health = Health.NEUTRAL;
  else if (
    phase === "Failed" ||
    WAITING_ERRORS.has(reason) ||
    reason === "Error"
  )
    health = Health.ERROR;
  else if (phase === "Running" && ready === total && total > 0)
    health = Health.OK;
  else health = Health.PENDING;

  const details = [reason];
  if (restarts > 0)
    details.push(`${restarts} restart${restarts === 1 ? "" : "s"}`);
  return { health, ready: `${ready}/${total}`, details };
}

function summarizeReplicated(obj: KubeObject): Summary {
  const spec = rec(obj.spec);
  const status = rec(obj.status);
  const desired =
    obj.kind === "DaemonSet"
      ? num(status.desiredNumberScheduled)
      : num(spec.replicas);
  const ready =
    obj.kind === "DaemonSet"
      ? num(status.numberReady)
      : num(status.readyReplicas);
  const health =
    desired === 0
      ? Health.NEUTRAL
      : ready === desired
        ? Health.OK
        : ready === 0
          ? Health.ERROR
          : Health.WARN;
  return { health, ready: `${ready}/${desired}`, details: [] };
}

function summarizeJob(job: KubeObject): Summary {
  const status = rec(job.status);
  const completions = num(rec(job.spec).completions) || 1;
  const succeeded = num(status.succeeded);
  const failed = num(status.failed);
  const health =
    succeeded >= completions
      ? Health.NEUTRAL
      : failed > 0
        ? Health.ERROR
        : Health.PENDING;
  const details = failed > 0 ? [`${failed} failed`] : [];
  return { health, ready: `${succeeded}/${completions}`, details };
}

function summarizeNode(node: KubeObject): Summary {
  const conditions = arr(rec(node.status).conditions).map(rec);
  const ready = conditions.find((c) => c.type === "Ready");
  const isReady = ready?.status === "True";
  const unschedulable = rec(node.spec).unschedulable === true;
  const details = [isReady ? "Ready" : "NotReady"];
  if (unschedulable) details.push("SchedulingDisabled");
  return {
    health: isReady ? (unschedulable ? Health.WARN : Health.OK) : Health.ERROR,
    details,
  };
}

function summarizePhase(obj: KubeObject, okPhases: string[]): Summary {
  const phase = str(rec(obj.status).phase) ?? "Unknown";
  return {
    health: okPhases.includes(phase)
      ? Health.OK
      : phase === "Pending"
        ? Health.PENDING
        : Health.ERROR,
    details: [phase],
  };
}

function summarizeEvent(ev: KubeObject): Summary {
  const raw = ev as unknown as Record<string, unknown>;
  const type = str(raw.type) ?? "Normal";
  const reason = str(raw.reason) ?? "";
  const count = num(raw.count);
  return {
    health: type === "Warning" ? Health.WARN : Health.NEUTRAL,
    details: [reason, ...(count > 1 ? [`x${count}`] : [])].filter(Boolean),
  };
}

export function summarize(def: KindDef, obj: KubeObject): Summary {
  switch (def.kind) {
    case "Pod":
      return summarizePod(obj);
    case "Deployment":
    case "StatefulSet":
    case "ReplicaSet":
    case "DaemonSet":
      return summarizeReplicated(obj);
    case "Job":
      return summarizeJob(obj);
    case "Node":
      return summarizeNode(obj);
    case "PersistentVolumeClaim":
    case "PersistentVolume":
      return summarizePhase(obj, ["Bound"]);
    case "Namespace":
      return summarizePhase(obj, ["Active"]);
    case "Event":
      return summarizeEvent(obj);
    default:
      return { health: Health.NEUTRAL, details: [] };
  }
}

export function healthCounts(summaries: Summary[]): Record<Health, number> {
  const counts: Record<Health, number> = {
    ok: 0,
    pending: 0,
    warn: 0,
    error: 0,
    neutral: 0,
  };
  for (const s of summaries) counts[s.health]++;
  return counts;
}
