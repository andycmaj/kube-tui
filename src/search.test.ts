import { describe, expect, test } from "bun:test";
import { fuzzyScore, parseSearchQuery } from "./search";

describe("fuzzyScore", () => {
  test("matches characters in order, case-insensitively", () => {
    expect(fuzzyScore("ngx", "Nginx-abc")).not.toBeNull();
    expect(fuzzyScore("xgn", "nginx")).toBeNull();
  });

  test("scores tighter matches lower", () => {
    const tight = fuzzyScore("api", "api-server");
    const loose = fuzzyScore("api", "a-pod-in-x");
    expect(tight).not.toBeNull();
    expect(loose).not.toBeNull();
    expect(tight ?? 0).toBeLessThan(loose ?? 0);
  });
});

describe("parseSearchQuery", () => {
  test("blank queries clear the search", () => {
    expect(parseSearchQuery("   ")).toBeNull();
  });

  test("plain text is a case-insensitive substring search", () => {
    expect(parseSearchQuery(" error ")).toEqual({
      query: "error",
      isRegex: false,
      regex: null,
    });
  });

  test("/pattern/ is a regex, case-insensitive unless flags are given", () => {
    const filter = parseSearchQuery("/time(out|d out)/");
    expect(filter?.isRegex).toBe(true);
    expect(filter?.regex?.flags).toBe("i");
    expect(filter?.regex?.test("Request TIMED OUT")).toBe(true);
    expect(parseSearchQuery("/Err/g")?.regex?.flags).toBe("g");
  });

  test("an invalid regex is reported rather than searched for literally", () => {
    expect(parseSearchQuery("/(unclosed/")).toEqual({
      query: "/(unclosed/",
      isRegex: true,
      regex: null,
    });
  });
});
