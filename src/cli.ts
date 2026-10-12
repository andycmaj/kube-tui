import { defineCommand, runMain } from "citty";

export interface CLIConfig {
  context?: string;
  namespace?: string;
  kubeconfig?: string;
}

let config: CLIConfig = {};

const main = defineCommand({
  meta: { name: "kube-tui", description: "A Kubernetes TUI" },
  args: {
    context: { type: "string", description: "kubeconfig context to use" },
    namespace: {
      type: "string",
      alias: "n",
      description: "namespace (default: all)",
    },
    kubeconfig: { type: "string", description: "path to a kubeconfig file" },
  },
  run({ args }) {
    config = {
      context: args.context,
      namespace: args.namespace,
      kubeconfig: args.kubeconfig,
    };
  },
});

export async function parseCLI(): Promise<CLIConfig> {
  await runMain(main);
  return config;
}
