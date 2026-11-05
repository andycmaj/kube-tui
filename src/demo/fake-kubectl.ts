// A stand-in kubectl for fixture mode. kubectlCommand runs this script instead
// of kubectl when KUBE_TUI_FIXTURE is set, so every read still goes through
// the app's real spawn, watch, and parsing code, just against the canned
// cluster in ./cluster.ts. Supports the subset of kubectl the TUI uses.

import type { KubeObject } from "../kube/types";
import { CONTEXT, LIVE_APPS, LOGS, OBJECTS } from "./cluster";

const forever = (): Promise<never> => new Promise(() => {});
const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const plural = (o: KubeObject): string => `${o.kind.toLowerCase()}s`;
const group = (o: KubeObject): string =>
  o.apiVersion.includes("/") ? (o.apiVersion.split("/")[0] ?? "") : "";
const resourceOf = (o: KubeObject): string =>
  group(o) ? `${plural(o)}.${group(o)}` : plural(o);

interface Parsed {
  positional: string[];
  flags: Map<string, string | true>;
}

// Splits argv into positionals and flags, dropping --context/--kubeconfig.
export function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  const valued = new Set([
    "-n",
    "--namespace",
    "-o",
    "--output",
    "-c",
    "--context",
    "--kubeconfig",
  ]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg.startsWith("-")) {
      const [name, inline] = arg.split(/=(.*)/s);
      if (inline !== undefined) flags.set(name ?? arg, inline);
      else if (valued.has(arg)) flags.set(arg, argv[++i] ?? "");
      else flags.set(arg, true);
    } else positional.push(arg);
  }
  return { positional, flags };
}

function flag(p: Parsed, ...names: string[]): string | true | undefined {
  for (const n of names) if (p.flags.has(n)) return p.flags.get(n);
  return undefined;
}

// Objects matching "pods", "deployments.apps", "a,b", or "pods/name".
export function select(
  resources: string,
  p: Parsed,
  name?: string,
): KubeObject[] {
  const ns = flag(p, "-n", "--namespace");
  const all = flag(p, "-A", "--all-namespaces") !== undefined;
  const wanted = resources.split(",");
  return OBJECTS.filter(
    (o) =>
      wanted.some((r) => r === resourceOf(o) || r === plural(o)) &&
      (name === undefined || o.metadata.name === name) &&
      (all ||
        ns === undefined ||
        typeof ns !== "string" ||
        o.metadata.namespace === ns ||
        !o.metadata.namespace),
  );
}

function age(o: KubeObject): string {
  const minutes = Math.floor(
    (Date.now() - Date.parse(o.metadata.creationTimestamp ?? "")) / 60_000,
  );
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 2880) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

function podColumns(o: KubeObject): string[] {
  const statuses =
    (rec(o.status).containerStatuses as Record<string, unknown>[]) ?? [];
  const ready = statuses.filter((c) => c.ready === true).length;
  const waiting = statuses
    .map((c) => rec(rec(c.state).waiting).reason)
    .find(Boolean);
  const restarts = statuses.reduce(
    (n, c) => n + Number(c.restartCount ?? 0),
    0,
  );
  return [
    `${ready}/${statuses.length}`,
    String(waiting ?? rec(o.status).phase ?? ""),
    String(restarts),
  ];
}

function table(objects: KubeObject[], withNamespace: boolean): string {
  const kind = objects[0]?.kind;
  const head =
    kind === "Pod"
      ? ["NAME", "READY", "STATUS", "RESTARTS", "AGE"]
      : kind === "Deployment"
        ? ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"]
        : ["NAME", "AGE"];
  const rows = objects.map((o) => {
    const s = rec(o.status);
    const middle =
      kind === "Pod"
        ? podColumns(o)
        : kind === "Deployment"
          ? [
              `${s.readyReplicas ?? 0}/${rec(o.spec).replicas ?? 0}`,
              String(s.updatedReplicas ?? 0),
              String(s.availableReplicas ?? 0),
            ]
          : [];
    return [o.metadata.name, ...middle, age(o)];
  });
  const all = [head, ...rows].map((r, i) =>
    withNamespace
      ? [
          i === 0 ? "NAMESPACE" : (objects[i - 1]?.metadata.namespace ?? ""),
          ...r,
        ]
      : r,
  );
  const widths = all[0]!.map(
    (_, c) => Math.max(...all.map((r) => (r[c] ?? "").length)) + 3,
  );
  return all
    .map((r) =>
      r
        .map((cell, c) => cell.padEnd(widths[c] ?? 0))
        .join("")
        .trimEnd(),
    )
    .join("\n");
}

function describe(o: KubeObject): string {
  const m = o.metadata;
  const labels = Object.entries(m.labels ?? {}).map(([k, v]) => `${k}=${v}`);
  const lines = [
    `Name:         ${m.name}`,
    ...(m.namespace ? [`Namespace:    ${m.namespace}`] : []),
    `Labels:       ${labels[0] ?? "<none>"}`,
    ...labels.slice(1).map((l) => `              ${l}`),
    `Created:      ${m.creationTimestamp}`,
  ];
  if (o.kind === "Pod") {
    const [ready, status, restarts] = podColumns(o);
    const spec = rec(o.spec);
    lines.push(
      `Node:         ${spec.nodeName}`,
      `Status:       ${status}`,
      `IP:           ${rec(o.status).podIP}`,
      "Containers:",
      ...((spec.containers as Record<string, unknown>[]) ?? []).flatMap((c) => [
        `  ${c.name}:`,
        `    Image:          ${c.image}`,
        `    Ready:          ${ready === "1/1"}`,
        `    Restart Count:  ${restarts}`,
      ]),
      "Events:",
      status === "CrashLoopBackOff"
        ? `  Warning  BackOff  2m (x31 over 40m)  kubelet  Back-off restarting failed container`
        : "  <none>",
    );
  } else if (o.spec) {
    lines.push(
      "Spec:",
      ...Bun.YAML.stringify(o.spec, null, 2)
        .trimEnd()
        .split("\n")
        .map((l) => `  ${l}`),
    );
  }
  if (o.status && o.kind !== "Pod") {
    lines.push(
      "Status:",
      ...Bun.YAML.stringify(o.status, null, 2)
        .trimEnd()
        .split("\n")
        .map((l) => `  ${l}`),
    );
  }
  return lines.join("\n");
}

function output(objects: KubeObject[], p: Parsed, single: boolean): string {
  const format = flag(p, "-o", "--output");
  if (format === "json") {
    return JSON.stringify(
      single ? objects[0] : { apiVersion: "v1", kind: "List", items: objects },
      null,
      2,
    );
  }
  if (format === "yaml")
    return Bun.YAML.stringify(
      single ? objects[0] : { items: objects },
      null,
      2,
    );
  if (format === "name")
    return objects
      .map((o) => `${o.kind.toLowerCase()}/${o.metadata.name}`)
      .join("\n");
  if (objects.length === 0) return "No resources found.";
  return table(objects, flag(p, "-A", "--all-namespaces") !== undefined);
}

function stamp(line: string, offsetMs: number, prefix: string): string {
  return `${prefix}${new Date(Date.now() - offsetMs).toISOString()} ${line}`;
}

async function logs(target: string, p: Parsed): Promise<void> {
  const [res, name] = target.split("/");
  const owner = select(res ?? "", p, name)[0];
  const pods =
    owner?.kind === "Pod"
      ? [owner]
      : OBJECTS.filter(
          (o) =>
            o.kind === "Pod" && o.metadata.labels?.app === owner?.metadata.name,
        );
  const usePrefix = flag(p, "--prefix") !== undefined;
  for (const pod of pods) {
    const app = pod.metadata.labels?.app ?? "";
    const crashing = podColumns(pod)[1] === "CrashLoopBackOff";
    const lines = LOGS[crashing ? `${app}-crash` : app] ?? [];
    const prefix = usePrefix ? `[pod/${pod.metadata.name}/${app}] ` : "";
    lines.forEach((l, i) =>
      console.log(stamp(l, (lines.length - i) * 4000, prefix)),
    );
  }
  if (!flag(p, "-f", "--follow")) return;
  const live = pods.filter(
    (pod) =>
      LIVE_APPS.has(pod.metadata.labels?.app ?? "") &&
      podColumns(pod)[1] === "Running",
  );
  const paths = ["/v1/orders", "/v1/cart", "/healthz", "/v1/products?page=2"];
  for (let i = 0; live.length > 0; i++) {
    await sleep(1200);
    const pod = live[i % live.length]!;
    const prefix = usePrefix
      ? `[pod/${pod.metadata.name}/${pod.metadata.labels?.app}] `
      : "";
    const path = paths[i % paths.length];
    console.log(
      stamp(
        `level=info msg="GET ${path}" status=200 dur=${(3 + ((i * 7) % 40)).toFixed(1)}ms`,
        0,
        prefix,
      ),
    );
  }
  await forever();
}

async function main(argv: string[]): Promise<number> {
  const p = parseArgs(argv);
  const [verb, ...rest] = p.positional;

  if (verb === "config" && rest[0] === "current-context") {
    console.log(CONTEXT);
    return 0;
  }

  if (verb === "get" || verb === "describe") {
    const [res = "", maybeName] = rest;
    const [resource, slashName] = res.split("/");
    const name = slashName ?? maybeName;
    const objects = select(resource ?? "", p, name);
    if (name !== undefined && objects.length === 0) {
      console.error(
        `Error from server (NotFound): ${resource} "${name}" not found`,
      );
      return 1;
    }
    if (verb === "describe") {
      console.log(objects.map(describe).join("\n\n\n"));
      return 0;
    }
    if (flag(p, "-w", "--watch")) {
      for (const o of objects)
        console.log(JSON.stringify({ type: "ADDED", object: o }));
      await forever();
    }
    console.log(output(objects, p, name !== undefined));
    return 0;
  }

  if (verb === "logs") {
    await logs(rest[0] ?? "", p);
    return 0;
  }

  if (
    verb === "delete" ||
    verb === "scale" ||
    (verb === "rollout" && rest[0] === "restart")
  ) {
    const target = verb === "rollout" ? rest[1] : rest[0];
    const done =
      verb === "delete" ? "deleted" : verb === "scale" ? "scaled" : "restarted";
    console.log(`${target} ${done} (fixture mode: nothing changed)`);
    return 0;
  }

  // exec / edit / anything interactive: explain, then exit like a finished shell.
  console.log(
    `kube-tui fixture mode: \`kubectl ${verb ?? ""}\` isn't available against the demo cluster.`,
  );
  await sleep(1500);
  return 0;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
