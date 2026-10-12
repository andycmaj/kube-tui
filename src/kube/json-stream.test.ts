import { describe, expect, test } from "bun:test";
import { JsonStreamSplitter } from "./json-stream";
import type { WatchEvent } from "./types";

describe("JsonStreamSplitter", () => {
  test("splits a recorded kubectl watch, chunked at arbitrary sizes", async () => {
    const raw = await Bun.file(
      `${import.meta.dir}/../../test/fixtures/pods-watch.jsonl`,
    ).text();
    const expected = raw.trim().split("\n").length;
    for (const size of [1, 7, 512, 100_000]) {
      const splitter = new JsonStreamSplitter<WatchEvent>();
      const events: WatchEvent[] = [];
      for (let i = 0; i < raw.length; i += size)
        events.push(...splitter.push(raw.slice(i, i + size)));
      expect(events).toHaveLength(expected);
      expect(events[0].type).toBe("ADDED");
      expect(events[0].object.kind).toBe("Pod");
    }
  });

  test("handles pretty-printed objects and braces inside strings", () => {
    const splitter = new JsonStreamSplitter<{ a: string }>();
    expect(splitter.push('{\n  "a": "}{\\"x"\n}\n{"a"')).toEqual([
      { a: '}{"x' },
    ]);
    expect(splitter.push(': "b"}')).toEqual([{ a: "b" }]);
  });
});
