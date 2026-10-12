# Agents

## Architecture

A k9s/Lens-style Kubernetes TUI. The app shell is
[`@andycmaj/opentui-app`](https://github.com/andycmaj/opentui-app) (boot,
focus, keymap, theme, toast, modals, palette, help, footer, log view); this repo
supplies only the Kubernetes domain. It mirrors `tilt-tui`'s structure.

- **kubectl is the backend.** Reads (`get`, `describe`, watches) and actions go
  through `src/kube/kubectl.ts`, so every kubeconfig auth plugin works. Watches
  are `kubectl get -w --output-watch-events -o json` subprocesses, one per
  expanded kind (`src/kube/watch.ts`), started/halted by `KubeProvider`.
- **Pure domain logic lives in `src/kube/`** with no opentui/solid imports:
  catalog, CRD discovery, watch reducer, status summaries, tree flattening. Unit
  test it with recorded fixtures in `test/fixtures/`.
- `src/keymap.ts` is the single binding table (`app`, `tree`, `content`).
  Footer, palette and help derive from it.
- Each pane is a `<Pane name>` registering handlers with `useScope`. Modals are
  rendered in `app.tsx`, outside the pane layout.
- Content views (describe, YAML, logs, kind tables) are text in one
  `createMemoryLogSource()` rendered by the framework's `LogBufferView`.

## TypeScript

- Never use `any`. Node/Bun types only (no DOM lib).
- Comments explain why, not what. No JSDoc.
- Enums as `const X = {...} as const`, never TS `enum`.
- Read Solid props lazily (no destructuring).

## Bun

Use `bun`, `bun test`, `Bun.spawn`, `Bun.file`. No global preload in
`bunfig.toml` (only `[test]`).

## Testing the TUI

- `bun dev` starts the app (pass `--context`, `-n` as needed).
- Drive it in tmux with a unique session name and `tmux capture-pane -p`.
- `SHOW_CONSOLE=true` or the backtick key opens the debug console.
- Reproduce a bug in a test before fixing it.
