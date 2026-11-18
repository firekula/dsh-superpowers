# Upstream provenance

The `skills/` directory under this package is vendored from the
[obra/superpowers](https://github.com/obra/superpowers) repository.

| Field | Value |
|---|---|
| Repository | https://github.com/obra/superpowers |
| Vendored release | v6.3.0 |
| Commit | `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` (2026-08-12) |
| License | MIT — see `LICENSE` (Copyright (c) 2025 Jesse Vincent) |

## Local adaptations

Two small, deliberate divergences from the vendored tree (re-applied by
`scripts/sync-upstream.ps1` after every re-sync):

1. `skills/using-superpowers/SKILL.md` — the "Platform Adaptation" list gains
   one entry: `DeepSeek Harness (DSH): references/dsh-tools.md`.
2. `skills/using-superpowers/references/dsh-tools.md` — new file, written for
   this adapter; maps DSH's tool surface (skill/subagent/todo_write/pwsh/…)
   onto the platform-agnostic conventions the upstream skills assume.

Everything else is byte-identical to upstream. References between skills that
upstream spells `superpowers:<name>` are rewritten to the plain kebab-case
name at load time (`normalizeSkillReferences` in `index.js`) because DSH
skill names carry no marketplace prefix; the vendored files themselves are
left pristine.

## Re-syncing upstream

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-upstream.ps1
```

Clones the upstream default branch into a temp directory, replaces `skills/`
with the fresh copy, re-applies the two adaptations above, and reports the
new commit. Review the diff before committing it.
