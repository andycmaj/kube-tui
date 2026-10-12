import { describe, expect, test } from "bun:test";
import { formatAge, Health, summarize, summarizePod } from "./status";
import { BUILTIN_CATEGORIES } from "./catalog";
import type { KindDef, KubeList, KubeObject } from "./types";

const kind = (k: string): KindDef =>
  BUILTIN_CATEGORIES.flatMap((c) => c.kinds).find((d) => d.kind === k)!;

const pod = (status: Record<string, unknown>, containers = 1): KubeObject => ({
  apiVersion: "v1",
  kind: "Pod",
  metadata: { name: "p", uid: "u" },
  spec: {
    containers: Array.from({ length: containers }, (_, i) => ({
      name: `c${i}`,
    })),
  },
  status,
});

describe("summarizePod", () => {
  test("recorded ContainerCreating pods are pending", async () => {
    const list = (await Bun.file(
      `${import.meta.dir}/../../test/fixtures/pods-kube-system.json`,
    ).json()) as KubeList;
    for (const p of list.items) {
      expect(summarizePod(p)).toMatchObject({
        health: Health.PENDING,
        details: ["ContainerCreating"],
      });
    }
  });

  test("running and ready", () => {
    const s = summarizePod(
      pod({
        phase: "Running",
        containerStatuses: [
          { ready: true, restartCount: 0, state: { running: {} } },
        ],
      }),
    );
    expect(s).toEqual({
      health: Health.OK,
      ready: "1/1",
      details: ["Running"],
    });
  });

  test("crashloop is an error and counts restarts", () => {
    const s = summarizePod(
      pod({
        phase: "Running",
        containerStatuses: [
          {
            ready: false,
            restartCount: 3,
            state: { waiting: { reason: "CrashLoopBackOff" } },
          },
        ],
      }),
    );
    expect(s).toEqual({
      health: Health.ERROR,
      ready: "0/1",
      details: ["CrashLoopBackOff", "3 restarts"],
    });
  });

  test("waiting init container shows Init: reason", () => {
    const s = summarizePod(
      pod({
        phase: "Pending",
        initContainerStatuses: [
          { ready: false, state: { waiting: { reason: "PodInitializing" } } },
        ],
      }),
    );
    expect(s.details[0]).toBe("Init:PodInitializing");
    expect(s.health).toBe(Health.PENDING);
  });
});

test("deployments compare ready to desired replicas", () => {
  const d = (ready: number, replicas: number): KubeObject => ({
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: "d", uid: "u" },
    spec: { replicas },
    status: { readyReplicas: ready },
  });
  expect(summarize(kind("Deployment"), d(3, 3))).toMatchObject({
    health: Health.OK,
    ready: "3/3",
  });
  expect(summarize(kind("Deployment"), d(1, 3)).health).toBe(Health.WARN);
  expect(summarize(kind("Deployment"), d(0, 3)).health).toBe(Health.ERROR);
  expect(summarize(kind("Deployment"), d(0, 0)).health).toBe(Health.NEUTRAL);
});

test("formatAge", () => {
  const now = Date.parse("2026-10-12T12:00:00Z");
  expect(formatAge("2026-10-12T11:59:30Z", now)).toBe("30s");
  expect(formatAge("2026-10-12T09:00:00Z", now)).toBe("3h");
  expect(formatAge("2026-10-07T12:00:00Z", now)).toBe("5d");
  expect(formatAge(undefined, now)).toBe("");
});
