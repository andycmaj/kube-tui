// Spawns kubectl. Every read and action goes through here (or through a PTY
// for interactive commands), so kubeconfig auth plugins work unchanged.

export class KubectlNotFoundError extends Error {
  constructor() {
    super("unable to locate kubectl in your environment");
    this.name = "KubectlNotFoundError";
  }
}

export class KubectlError extends Error {
  constructor(
    public readonly args: string[],
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(
      `kubectl ${args.join(" ")} failed (exit ${exitCode}): ${stderr.trim()}`,
    );
    this.name = "KubectlError";
  }
}

export interface KubeTarget {
  context?: string;
  kubeconfig?: string;
}

// KUBE_TUI_FIXTURE swaps kubectl for a fake that serves a canned cluster
// (src/demo), for demos and UI work without a cluster. Source runs only: a
// compiled binary has no bun or script to run it with.
export function fixtureMode(): boolean {
  return Boolean(process.env.KUBE_TUI_FIXTURE);
}

const FAKE_KUBECTL = new URL("../demo/fake-kubectl.ts", import.meta.url)
  .pathname;

export function resolveKubectl(override?: string): string {
  if (fixtureMode()) return FAKE_KUBECTL;
  const binary = Bun.which(override ?? "kubectl");
  if (!binary) throw new KubectlNotFoundError();
  return binary;
}

export function targetArgs(target: KubeTarget): string[] {
  const args: string[] = [];
  if (target.kubeconfig) args.push("--kubeconfig", target.kubeconfig);
  if (target.context) args.push("--context", target.context);
  return args;
}

export function kubectlCommand(target: KubeTarget, args: string[]): string[] {
  const kubectl = resolveKubectl();
  const argv = [...targetArgs(target), ...args];
  return fixtureMode()
    ? [process.execPath, kubectl, ...argv]
    : [kubectl, ...argv];
}

export interface KubectlResult {
  stdout: string;
  stderr: string;
}

export async function runKubectl(
  target: KubeTarget,
  args: string[],
  // allowFailure returns whatever stdout kubectl managed, e.g. a multi-kind
  // `get` where one kind is forbidden still lists the others.
  options: { signal?: AbortSignal; allowFailure?: boolean } = {},
): Promise<KubectlResult> {
  const proc = Bun.spawn(kubectlCommand(target, args), {
    stdout: "pipe",
    stderr: "pipe",
    signal: options.signal,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0 && !options.allowFailure)
    throw new KubectlError(args, exitCode, stderr);
  return { stdout, stderr };
}

export async function runKubectlJson<T>(
  target: KubeTarget,
  args: string[],
): Promise<T> {
  const { stdout } = await runKubectl(target, [...args, "-o", "json"]);
  return JSON.parse(stdout) as T;
}
