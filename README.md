# kube-tui

A k9s/Lens-style Kubernetes TUI built on
[`@andycmaj/opentui-app`](https://github.com/andycmaj/opentui-app).

- Resource tree: built-in kinds grouped like Lens, custom resources discovered
  from CRDs. Everything starts collapsed; expanding a kind starts a live watch.
- Content pane: `describe` (default), YAML, logs, or kubectl's own table for a
  selected kind.
- `:` palette jumps to any kind (k9s-style), `n` switches namespace, `?` shows
  every binding.

## Requirements

- bun
- kubectl on `PATH`, with a working kubeconfig

## Running

```sh
bun install
bun dev                       # current context, all namespaces
bun dev --context my-ctx -n default
```
