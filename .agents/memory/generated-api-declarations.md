---
name: Generated API declaration freshness
description: Distinguishing genuinely missing generated exports from stale composite-library declarations
---

If a server typecheck reports that a generated API export is missing even though codegen emitted it and the package source exports it, check the composite library's declaration freshness before changing the API contract.

**Why:** An unrelated shared-AI library build failure can stop the full workspace build before generated API declarations refresh. The development runtime can load the new source successfully while TypeScript still sees the old declarations.

**How to apply:** After codegen, build the affected generated library independently when the full workspace build is blocked. Then check the changed server files. Preserve the distinction between fresh feature checks and unrelated whole-project build failures; do not refactor unrelated libraries just to validate a feature.