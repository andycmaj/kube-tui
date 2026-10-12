import { expect, test } from "bun:test";
import { BUILTIN_CATEGORIES, kindLabel } from "./catalog";

test("kind labels pluralise like Lens", () => {
  const labels = BUILTIN_CATEGORIES.flatMap((c) => c.kinds).map(kindLabel);
  expect(labels).toContain("Pods");
  expect(labels).toContain("Endpoints");
  expect(labels).toContain("Ingresses");
  expect(labels).toContain("NetworkPolicies");
  expect(labels).toContain("PersistentVolumeClaims");
  expect(labels).toContain("HorizontalPodAutoscalers");
  expect(labels).toContain("StorageClasses");
});

test("kind keys are unique", () => {
  const plurals = BUILTIN_CATEGORIES.flatMap((c) => c.kinds).map(
    (k) => `${k.plural}.${k.group}`,
  );
  expect(new Set(plurals).size).toBe(plurals.length);
});
