# TODO

### describe view yaml highlighting

describe view (and any view that renders raw yaml or json) should have syntax highlighting

should have json/yaml query/nav

- expand/collapse
- query

should have full-text / search

### quick search palette

spacebar shoudl open quick nav palette
fuzzy search like in tilt-tui resource search

### Events is a feed, not a tree node

don't list all events as tree-view items? what else can have hundreds of available items?
events is a list . maybe it gets a special node type, e.g. a Feed. main view shows feed cards (like <https://github.com/andycmaj/ghdash/blob/main/src/components/sections/feed-section.tsx>)

### theme support

from opentui-app

### help bar responsiveness

bug (opentui-app): currently only shows either "?" or the entire bar. these should be gracefully cutoff based on screen width so it's not just all or nothing.
