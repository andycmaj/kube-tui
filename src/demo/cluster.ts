// A small canned cluster for fixture mode (KUBE_TUI_FIXTURE): a shop app with
// a crash-looping worker, a finished migration job, cert-manager CRDs, and a
// few system pods. Plain data, so the fake kubectl can serve it.

import type { KubeObject } from "../kube/types";

const now = Date.now();
const ago = (minutes: number): string =>
  new Date(now - minutes * 60_000).toISOString();

let uid = 0;
function obj(
  apiVersion: string,
  kind: string,
  name: string,
  namespace: string | undefined,
  rest: {
    labels?: Record<string, string>;
    age?: number;
    spec?: object;
    status?: object;
  } = {},
): KubeObject {
  return {
    apiVersion,
    kind,
    metadata: {
      name,
      ...(namespace ? { namespace } : {}),
      uid: `00000000-0000-4000-8000-${String(++uid).padStart(12, "0")}`,
      creationTimestamp: ago(rest.age ?? 180),
      labels: rest.labels ?? {},
    },
    spec: rest.spec as Record<string, unknown> | undefined,
    status: rest.status as Record<string, unknown> | undefined,
  };
}

interface PodOptions {
  image: string;
  app: string;
  phase?: string;
  waiting?: string;
  restarts?: number;
  age?: number;
  node?: string;
}

function pod(namespace: string, name: string, o: PodOptions): KubeObject {
  const running = !o.waiting && (o.phase ?? "Running") === "Running";
  return obj("v1", "Pod", name, namespace, {
    labels: { app: o.app },
    age: o.age,
    spec: {
      nodeName: o.node ?? "kind-worker",
      containers: [{ name: o.app, image: o.image }],
    },
    status: {
      phase: o.phase ?? "Running",
      podIP: `10.244.1.${(uid * 7) % 250}`,
      startTime: ago(o.age ?? 180),
      containerStatuses: [
        {
          name: o.app,
          image: o.image,
          ready: running,
          restartCount: o.restarts ?? 0,
          state: o.waiting
            ? { waiting: { reason: o.waiting } }
            : { running: { startedAt: ago(o.age ?? 180) } },
        },
      ],
    },
  });
}

function deployment(
  namespace: string,
  name: string,
  replicas: number,
  ready: number,
  image: string,
): KubeObject {
  return obj("apps/v1", "Deployment", name, namespace, {
    labels: { app: name },
    spec: {
      replicas,
      selector: { matchLabels: { app: name } },
      template: { spec: { containers: [{ name, image }] } },
    },
    status: {
      replicas,
      readyReplicas: ready,
      availableReplicas: ready,
      updatedReplicas: replicas,
    },
  });
}

function node(name: string, role: string): KubeObject {
  return obj("v1", "Node", name, undefined, {
    labels: {
      "kubernetes.io/hostname": name,
      [`node-role.kubernetes.io/${role}`]: "",
    },
    age: 4320,
    status: {
      conditions: [{ type: "Ready", status: "True" }],
      nodeInfo: { kubeletVersion: "v1.33.1", osImage: "Debian GNU/Linux 12" },
    },
  });
}

const crd = (
  plural: string,
  group: string,
  kind: string,
  scope: string,
): KubeObject =>
  obj(
    "apiextensions.k8s.io/v1",
    "CustomResourceDefinition",
    `${plural}.${group}`,
    undefined,
    {
      age: 2880,
      spec: {
        group,
        names: { kind, plural, singular: kind.toLowerCase(), shortNames: [] },
        scope,
        versions: [{ name: "v1", served: true, storage: true }],
      },
    },
  );

export const CONTEXT = "kind-demo";

export const OBJECTS: KubeObject[] = [
  node("kind-control-plane", "control-plane"),
  node("kind-worker", "worker"),
  node("kind-worker2", "worker"),

  ...["default", "shop", "kube-system", "cert-manager"].map((ns) =>
    obj("v1", "Namespace", ns, undefined, {
      age: 4320,
      status: { phase: "Active" },
    }),
  ),

  deployment("shop", "api", 3, 3, "ghcr.io/acme/shop-api:1.42.0"),
  deployment("shop", "web", 2, 2, "ghcr.io/acme/shop-web:1.42.0"),
  deployment("shop", "worker", 2, 1, "ghcr.io/acme/shop-worker:1.42.0"),
  obj("apps/v1", "StatefulSet", "postgres", "shop", {
    labels: { app: "postgres" },
    spec: { replicas: 1 },
    status: { replicas: 1, readyReplicas: 1 },
  }),
  pod("shop", "api-7d9f8c6b5-x2k4p", {
    app: "api",
    image: "ghcr.io/acme/shop-api:1.42.0",
    age: 42,
  }),
  pod("shop", "api-7d9f8c6b5-q8mzt", {
    app: "api",
    image: "ghcr.io/acme/shop-api:1.42.0",
    age: 42,
    node: "kind-worker2",
  }),
  pod("shop", "api-7d9f8c6b5-hv7rn", {
    app: "api",
    image: "ghcr.io/acme/shop-api:1.42.0",
    age: 41,
  }),
  pod("shop", "web-5c8d7f9b4-mw2lx", {
    app: "web",
    image: "ghcr.io/acme/shop-web:1.42.0",
    age: 42,
  }),
  pod("shop", "web-5c8d7f9b4-t9pqk", {
    app: "web",
    image: "ghcr.io/acme/shop-web:1.42.0",
    age: 42,
    node: "kind-worker2",
  }),
  pod("shop", "worker-6b4f9d8c7-jz5nd", {
    app: "worker",
    image: "ghcr.io/acme/shop-worker:1.42.0",
    age: 42,
  }),
  pod("shop", "worker-6b4f9d8c7-rk3vb", {
    app: "worker",
    image: "ghcr.io/acme/shop-worker:1.42.0",
    age: 42,
    waiting: "CrashLoopBackOff",
    restarts: 7,
  }),
  pod("shop", "postgres-0", {
    app: "postgres",
    image: "postgres:17",
    age: 1440,
  }),
  obj("batch/v1", "Job", "migrate-29384710", "shop", {
    labels: { app: "migrate" },
    age: 43,
    spec: { completions: 1 },
    status: { succeeded: 1, completionTime: ago(42) },
  }),
  obj("batch/v1", "CronJob", "nightly-report", "shop", {
    spec: { schedule: "0 3 * * *" },
    status: { lastScheduleTime: ago(600) },
  }),
  ...["api", "web", "postgres"].map((name) =>
    obj("v1", "Service", name, "shop", {
      spec: {
        type: "ClusterIP",
        clusterIP: `10.96.${name.length}.${name.charCodeAt(0)}`,
        ports: [{ port: 80 }],
      },
    }),
  ),
  obj("v1", "ConfigMap", "api-config", "shop", { age: 1440 }),
  obj("v1", "Secret", "api-secrets", "shop", { age: 1440 }),
  obj("cert-manager.io/v1", "Certificate", "shop-tls", "shop", {
    spec: { secretName: "shop-tls", dnsNames: ["shop.example.com"] },
    status: { conditions: [{ type: "Ready", status: "True" }] },
  }),

  deployment(
    "cert-manager",
    "cert-manager",
    1,
    1,
    "quay.io/jetstack/cert-manager-controller:v1.17.2",
  ),
  pod("cert-manager", "cert-manager-7c9b6f5d8-4xlnp", {
    app: "cert-manager",
    image: "quay.io/jetstack/cert-manager-controller:v1.17.2",
    age: 2880,
  }),
  obj("apps/v1", "DaemonSet", "kindnet", "kube-system", {
    status: { desiredNumberScheduled: 3, numberReady: 3 },
  }),
  pod("kube-system", "coredns-6d668d687-5bq7w", {
    app: "kube-dns",
    image: "registry.k8s.io/coredns/coredns:v1.12.0",
    age: 4320,
  }),
  pod("kube-system", "coredns-6d668d687-zr2kd", {
    app: "kube-dns",
    image: "registry.k8s.io/coredns/coredns:v1.12.0",
    age: 4320,
  }),
  pod("kube-system", "etcd-kind-control-plane", {
    app: "etcd",
    image: "registry.k8s.io/etcd:3.5.21-0",
    age: 4320,
    node: "kind-control-plane",
  }),

  crd("certificates", "cert-manager.io", "Certificate", "Namespaced"),
  crd("issuers", "cert-manager.io", "Issuer", "Namespaced"),
  crd("clusterissuers", "cert-manager.io", "ClusterIssuer", "Cluster"),
];

// Log lines per app label. The fake kubectl replays these and, for apps in
// LIVE_APPS, keeps appending request lines so the log view moves.
export const LOGS: Record<string, string[]> = {
  api: [
    'level=info msg="starting shop-api" version=1.42.0',
    'level=info msg="connected to postgres" host=postgres.shop.svc',
    'level=info msg="listening" addr=:8080',
  ],
  web: [
    "vite preview on :4173",
    "GET / 200 3ms",
    "GET /assets/index-9f2c.js 200 1ms",
  ],
  worker: [
    'level=info msg="starting worker" queues=orders,emails',
    'level=info msg="processed job" queue=orders id=8812 dur=41ms',
  ],
  "worker-crash": [
    'level=info msg="starting worker" queues=orders,emails',
    'level=error msg="redis: dial tcp 10.96.0.42:6379: connect: connection refused"',
    "panic: queue backend unavailable",
  ],
  postgres: ["LOG:  database system is ready to accept connections"],
};

export const LIVE_APPS = new Set(["api", "web", "worker"]);
