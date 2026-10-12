// A kubectl watch as an Effection operation. Events are delivered by callback
// rather than a Stream so none are dropped before a consumer subscribes; the
// operation returns when kubectl exits and halting it kills the process.

import { call, type Operation } from "effection";
import { JsonStreamSplitter } from "./json-stream";
import { kubectlCommand, KubectlError, type KubeTarget } from "./kubectl";
import { resourceArg, type KindDef, type WatchEvent } from "./types";

export const ALL_NAMESPACES = "all";

export function namespaceArgs(def: KindDef, namespace: string): string[] {
  if (!def.namespaced) return [];
  return namespace === ALL_NAMESPACES
    ? ["--all-namespaces"]
    : ["-n", namespace];
}

export function* watchKind(
  target: KubeTarget,
  def: KindDef,
  namespace: string,
  onEvent: (event: WatchEvent) => void,
): Operation<void> {
  const args = [
    "get",
    resourceArg(def),
    ...namespaceArgs(def, namespace),
    "--watch",
    "--output-watch-events",
    "-o",
    "json",
  ];
  const proc = Bun.spawn(kubectlCommand(target, args), {
    stdout: "pipe",
    stderr: "pipe",
  });
  try {
    const splitter = new JsonStreamSplitter<WatchEvent>();
    const decoder = new TextDecoder();
    yield* call(async () => {
      for await (const chunk of proc.stdout) {
        for (const event of splitter.push(
          decoder.decode(chunk, { stream: true }),
        ))
          onEvent(event);
      }
    });
    const exitCode = yield* call(() => proc.exited);
    if (exitCode !== 0) {
      const stderr = yield* call(() => new Response(proc.stderr).text());
      throw new KubectlError(args, exitCode, stderr);
    }
  } finally {
    if (proc.exitCode === null) proc.kill();
  }
}
