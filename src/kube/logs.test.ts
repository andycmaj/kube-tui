import { describe, expect, test } from "bun:test";
import { isLoggable, logArgs, podContainers } from "./logs";
import type { KindDef, KubeObject } from "./types";

const podDef: KindDef = {
  kind: "Pod",
  plural: "pods",
  group: "",
  version: "v1",
  namespaced: true,
};
const deployDef: KindDef = {
  kind: "Deployment",
  plural: "deployments",
  group: "apps",
  version: "v1",
  namespaced: true,
};

const pod: KubeObject = {
  apiVersion: "v1",
  kind: "Pod",
  metadata: { name: "web-1", namespace: "shop", uid: "u1" },
  spec: {
    initContainers: [{ name: "migrate" }],
    containers: [{ name: "app" }, { name: "sidecar" }],
  },
};

const deployment: KubeObject = {
  apiVersion: "apps/v1",
  kind: "Deployment",
  metadata: { name: "web", namespace: "shop", uid: "u2" },
  spec: { template: { spec: { containers: [{ name: "app" }] } } },
};

describe("podContainers", () => {
  test("lists a pod's containers, then its init containers", () => {
    expect(podContainers(pod)).toEqual(["app", "sidecar", "migrate"]);
  });

  test("reads a workload's pod template", () => {
    expect(podContainers(deployment)).toEqual(["app"]);
  });

  test("tolerates objects without a pod spec", () => {
    expect(
      podContainers({ ...deployment, spec: { template: "nope" } }),
    ).toEqual([]);
  });
});

describe("logArgs", () => {
  test("streams every container with a prefix by default", () => {
    expect(logArgs(podDef, pod, null)).toEqual([
      "logs",
      "pods/web-1",
      "-n",
      "shop",
      "--follow",
      "--timestamps",
      "--tail=500",
      "--all-containers",
      "--prefix",
    ]);
  });

  test("streams one container without a prefix", () => {
    expect(logArgs(deployDef, deployment, "app")).toEqual([
      "logs",
      "deployments.apps/web",
      "-n",
      "shop",
      "--follow",
      "--timestamps",
      "--tail=500",
      "-c",
      "app",
    ]);
  });
});

test("isLoggable covers pods and the workloads that own them", () => {
  expect(isLoggable(podDef)).toBe(true);
  expect(isLoggable(deployDef)).toBe(true);
  expect(isLoggable({ ...podDef, kind: "Service", plural: "services" })).toBe(
    false,
  );
});
