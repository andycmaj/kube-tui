import { expect, test } from "bun:test";
import { applyWatchEvent, sortObjects } from "./watch-reducer";
import type { KubeObject, WatchEvent } from "./types";

const obj = (
  name: string,
  uid: string,
  namespace = "default",
  rv = "1",
): KubeObject => ({
  apiVersion: "v1",
  kind: "Pod",
  metadata: { name, uid, namespace, resourceVersion: rv },
});

test("added, modified, deleted", () => {
  let m = applyWatchEvent({}, { type: "ADDED", object: obj("a", "1") });
  m = applyWatchEvent(m, { type: "ADDED", object: obj("b", "2", "batch") });
  m = applyWatchEvent(m, {
    type: "MODIFIED",
    object: obj("a", "1", "default", "2"),
  });
  expect(m["1"].metadata.resourceVersion).toBe("2");
  m = applyWatchEvent(m, { type: "DELETED", object: obj("b", "2", "batch") });
  expect(Object.keys(m)).toEqual(["1"]);
});

test("bookmarks, errors and unknown deletes leave the map untouched", () => {
  const m = applyWatchEvent({}, { type: "ADDED", object: obj("a", "1") });
  const bookmark: WatchEvent = { type: "BOOKMARK", object: obj("", "") };
  expect(applyWatchEvent(m, bookmark)).toBe(m);
  expect(applyWatchEvent(m, { type: "DELETED", object: obj("x", "9") })).toBe(
    m,
  );
});

test("sorted by namespace then name", () => {
  const m = { 1: obj("b", "1"), 2: obj("a", "2"), 3: obj("z", "3", "batch") };
  expect(sortObjects(m).map((o) => o.metadata.name)).toEqual(["z", "a", "b"]);
});
