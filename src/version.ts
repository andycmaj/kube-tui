import pkg from "../package.json";

// Injected by script/build.ts so compiled binaries report the release (or beta) version.
declare const KUBE_TUI_VERSION: string | undefined;

export const APP_VERSION =
  typeof KUBE_TUI_VERSION === "string" && KUBE_TUI_VERSION.length > 0
    ? KUBE_TUI_VERSION
    : pkg.version;
