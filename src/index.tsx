// Entry point for kube-tui

import { runApp } from "@andycmaj/opentui-app";
import { App } from "./app";
import { parseCLI } from "./cli";
import { KubectlNotFoundError, resolveKubectl } from "./kube/kubectl";

const config = await parseCLI();

try {
  resolveKubectl();
} catch (err) {
  if (err instanceof KubectlNotFoundError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

await runApp(() => (
  <App
    target={{ context: config.context, kubeconfig: config.kubeconfig }}
    namespace={config.namespace}
  />
));
