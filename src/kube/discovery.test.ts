import { expect, test } from "bun:test";
import { customGroupsFromCrds } from "./discovery";
import type { KubeList } from "./types";

test("groups recorded CRDs by API group, sorted", async () => {
  const list = (await Bun.file(
    `${import.meta.dir}/../../test/fixtures/crds.json`,
  ).json()) as KubeList;
  const groups = customGroupsFromCrds(list.items);
  expect(groups.map((g) => g.group)).toEqual([
    "helm.cattle.io",
    "k3s.cattle.io",
  ]);
  expect(groups[0].kinds.map((k) => k.kind)).toEqual([
    "HelmChart",
    "HelmChartConfig",
  ]);
  const etcd = groups[1].kinds.find((k) => k.kind === "ETCDSnapshotFile");
  expect(etcd).toMatchObject({
    plural: "etcdsnapshotfiles",
    version: "v1",
    namespaced: false,
  });
});

test("prefers the storage version among served versions", () => {
  const groups = customGroupsFromCrds([
    {
      apiVersion: "apiextensions.k8s.io/v1",
      kind: "CustomResourceDefinition",
      metadata: { name: "widgets.acme.io", uid: "u" },
      spec: {
        group: "acme.io",
        scope: "Namespaced",
        names: { kind: "Widget", plural: "widgets" },
        versions: [
          { name: "v1alpha1", served: false, storage: false },
          { name: "v1beta1", served: true, storage: false },
          { name: "v1", served: true, storage: true },
        ],
      },
    },
  ]);
  expect(groups[0].kinds[0].version).toBe("v1");
});
