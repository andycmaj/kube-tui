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

export function resolveKubectl(override?: string): string {
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
  return [resolveKubectl(), ...targetArgs(target), ...args];
}

export interface KubectlResult {
  stdout: string;
  stderr: string;
}

export async function runKubectl(
  target: KubeTarget,
  args: string[],
  options: { signal?: AbortSignal } = {},
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
  if (exitCode !== 0) throw new KubectlError(args, exitCode, stderr);
  return { stdout, stderr };
}

export async function runKubectlJson<T>(
  target: KubeTarget,
  args: string[],
): Promise<T> {
  const { stdout } = await runKubectl(target, [...args, "-o", "json"]);
  return JSON.parse(stdout) as T;
}
