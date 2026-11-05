# kube-tui

A k9s/Lens-style Kubernetes TUI built on
[`@andycmaj/opentui-app`](https://github.com/andycmaj/opentui-app).

- Resource tree: built-in kinds grouped like Lens, custom resources discovered
  from CRDs. Everything starts collapsed; expanding a kind starts a live watch.
- Content pane: `describe` (default), YAML, logs, or kubectl's own table for a
  selected kind.
- Shell (`s`) and edit (`e`) run inside the content pane on an embedded
  terminal (Bun PTY + libghostty-vt). Every key goes to the program except
  `ctrl+]`, which detaches to the tree; `Tab` re-attaches.
- `ctrl+d` delete, `shift+r` rollout restart, `shift+s` scale, each confirmed in
  a dialog.
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

### Fixture mode

Run against a canned cluster, with no kubectl or cluster:

```sh
KUBE_TUI_FIXTURE=default bun dev
```

`kubectlCommand` then runs `src/demo/fake-kubectl.ts`, which answers the
kubectl subset the TUI uses from the demo cluster in `src/demo/cluster.ts`, so
the app's real watch and parsing code still runs. Shells and edits print a
notice instead of opening. Source runs only (not compiled binaries).
`demo/demo.keys` drives the recording on the project website.
