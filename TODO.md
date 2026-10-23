# TODO

### describe view yaml highlighting

describe view (and any view that renders raw yaml or json) should have syntax highlighting

should have json/yaml query/nav

- expand/collapse
- query

should have full-text / search

### Events is a feed, not a tree node

don't list all events as tree-view items? what else can have hundreds of available items?
events is a list . maybe it gets a special node type, e.g. a Feed. main view shows feed cards (like <https://github.com/andycmaj/ghdash/blob/main/src/components/sections/feed-section.tsx>)

### theme support

from opentui-app

### help bar responsiveness

bug (opentui-app): currently only shows either "?" or the entire bar. these should be gracefully cutoff based on screen width so it's not just all or nothing.

related: `Pane` is `flexShrink: 0`, so the full-width footer widens the content pane past the screen edge and its header tags (namespace, follow, loading) render off-screen. kube-tui puts find/container status in the title until this is fixed.
