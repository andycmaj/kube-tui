import { describe, expect, test } from "bun:test";
import { parseArgs, select } from "./fake-kubectl";

describe("fake kubectl", () => {
  test("parses flags, values, and drops nothing positional", () => {
    const p = parseArgs([
      "--context",
      "x",
      "get",
      "pods",
      "-n",
      "shop",
      "--watch",
      "-o",
      "json",
      "--tail=50",
    ]);
    expect(p.positional).toEqual(["get", "pods"]);
    expect(p.flags.get("-n")).toBe("shop");
    expect(p.flags.get("--watch")).toBe(true);
    expect(p.flags.get("--tail")).toBe("50");
  });

  test("selects by plural, plural.group, namespace, and name", () => {
    const shop = parseArgs(["get", "pods", "-n", "shop"]);
    expect(
      select("pods", shop).every((o) => o.metadata.namespace === "shop"),
    ).toBe(true);
    expect(
      select("deployments.apps", parseArgs(["--all-namespaces"])).map(
        (o) => o.metadata.name,
      ),
    ).toContain("cert-manager");
    expect(select("pods", shop, "postgres-0")).toHaveLength(1);
    expect(select("certificates.cert-manager.io", shop)).toHaveLength(1);
  });

  test("cluster-scoped kinds ignore the namespace filter", () => {
    expect(select("nodes", parseArgs(["-n", "shop"]))).toHaveLength(3);
  });
});
