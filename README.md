# dsh-superpowers

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[obra/superpowers](https://github.com/obra/superpowers) for **DeepSeek Harness
(DSH)**, packaged as an installable DSH bundle.

The bundle does two things in every session of the profile that selects it:

1. **Registers the Superpowers skill library** — 14 `SKILL.md` bundles covering
   brainstorming, plan writing, subagent-driven development, TDD, systematic
   debugging, code review, and branch finishing — as DSH runtime skills, so they
   appear in the session skill catalog and load through the `skill` tool.
2. **Injects a session-start bootstrap** — the full `using-superpowers` text as
   the durable system-prompt section `superpowers:bootstrap`, so the agent is
   told to check for an applicable skill before it acts. The section survives
   compaction.

> Upstream: superpowers v6.3.0, commit `b36e0829` (MIT). The vendored skill
> content is byte-identical to upstream except for two small DSH adaptations
> documented in [UPSTREAM.md](UPSTREAM.md).

## Install

Requirements: a DSH build with bundle support (tested on `0.2.2-rc.3`), and
either the Desktop app or the `dsh` CLI. The package is plain ESM with no
runtime dependencies and **no build step**, so pnpm's build-script approval
(`allowBuilds`) is not needed.

### Desktop

1. Open **Plugins** in the Web sidebar.
2. Click **Add plugin**, or the arrow → **Install a third-party plugin**.
3. Paste the Git address below, then install and enable the bundle.
4. Start a **new session** (or restart the app) and verify as described below.

### CLI

```sh
# latest main
dsh plugin --profile <profile> add github:firekula/dsh-superpowers

# reproducible: pin a full commit (recommended for shared setups)
dsh plugin --profile <profile> add github:firekula/dsh-superpowers#<40-char-commit>
```

`dsh plugin` also accepts a local checkout (installed as a link, handy for
development) and a packed tarball:

```sh
dsh plugin --profile <profile> add /absolute/path/to/dsh-superpowers
dsh plugin --profile <profile> add ./dsh-superpowers-0.2.0.tgz
```

### Update and uninstall

- **Update:** reinstall at a newer commit/tag, or use the **Update available**
  action on the Plugins page. Registry installs update in place; Git installs
  are replaced by their pinned spec.
- **Uninstall:** disable or remove the bundle on the **Plugins** page, or run
  `dsh plugin --profile <profile> remove dsh-superpowers`.
- Disabling the bundle removes the 14 skills and the bootstrap from new
  sessions; it does not delete any other plugin or profile configuration.

## Verify it is active

In a **new session**:

1. The system prompt contains **“You have superpowers.”**.
2. The skill catalog (`available_skills`) lists the 14 skills below.
3. Ask for a small feature; the agent should load `brainstorming` before
   writing code.
4. Type `/brainstorming` to invoke that skill explicitly in one step.

`dsh --profile <profile> --dump-config` shows the `# == dsh-superpowers` layer
and the `superpowers` row.

## What triggers what

- **Automatic:** skill registration, the session skill catalog (delivered before
  the first request when the `skill` tool is mounted), and the durable
  `superpowers:bootstrap` system-prompt section. Users can invoke any listed
  skill with `/skill-name`.
- **Model-driven:** whether the agent actually follows a skill's workflow.
  DSH injects the instructions; it does not force a particular skill. Weaker
  models or conflicting instructions can ignore the bootstrap.

## Skills

| Skill | Purpose |
|---|---|
| `brainstorming` | Turn an idea into a design/spec before building |
| `writing-plans` | Break a spec into 2–5 minute executable tasks |
| `executing-plans` | Batched execution with human checkpoints |
| `subagent-driven-development` | One fresh subagent per task, two-stage review |
| `dispatching-parallel-agents` | Fan out independent tasks |
| `test-driven-development` | RED-GREEN-REFACTOR loop |
| `systematic-debugging` | Four-phase root-cause investigation |
| `verification-before-completion` | Evidence before “done” claims |
| `requesting-code-review` | Dispatch a review subagent |
| `receiving-code-review` | Handle review feedback rigorously |
| `using-git-worktrees` | Isolated workspace (git worktree fallback on DSH) |
| `finishing-a-development-branch` | Merge / PR / keep / discard decision |
| `using-superpowers` | The skill-system overview (also injected) |
| `writing-skills` | Author and test new skills |

## Configuration

Set these in the environment that launches DSH (restart to apply):

| Variable | Default | Meaning |
|---|---|---|
| `DSH_SUPERPOWERS_SKILL_DIR` | bundled `skills/` | Alternative skills root, scanned as `<dir>/<name>/SKILL.md` |
| `DSH_SUPERPOWERS_DISABLE_BOOTSTRAP` | unset | Any truthy value (`1`/`true`/`yes`/`on`) keeps the skills but skips the system-prompt section |

## How it works

`index.js` mounts a Cordis plugin that:

- discovers `skills/<name>/SKILL.md`, validates the kebab-case name, parses the
  frontmatter, rewrites upstream `superpowers:<name>` references to plain DSH
  names, and calls `ctx.skills.register(...)` with `source: 'bundled'` and a
  directory `resourceBase`;
- registers the `superpowers:bootstrap` system-prompt section at order 50
  (after the persona, before tool guidance).

The bundle's `cordis.patch.yml` inserts one row naming this package. DSH
resolves that name from the profile's `node_modules`, so the install path is
not baked into the configuration.

## Repository layout

```
cordis.patch.yml             bundle patch layer
package.json                 bundle manifest (dsh.bundle.patch, exports, icon)
index.js                     plugin entry (zero runtime dependencies)
lib/frontmatter.js           SKILL.md frontmatter parser
lib/bootstrap.js             bootstrap section text
skills/                      vendored upstream skills (14)
adaptations/dsh-tools.md     authoritative copy of the DSH tool mapping
locale/en.json, zh.json      Plugin Manager title and description
icon.svg                     bundle icon
scripts/sync-upstream.ps1    re-vendor from obra/superpowers
test/bundle.test.mjs         packaging test (Node builtins only)
test/smoke.test.mjs          integration test against a real DSH install
UPSTREAM.md                  provenance and adaptations
```

## Tests

```sh
npm test                     # packaging test, no DSH required
node test/smoke.test.mjs     # integration, needs a DSH node_modules
```

The smoke test boots a bare Cordis context with a real `SkillRegistry` and
`SystemPrompt`; set `DSH_NODE_MODULES` if auto-detection fails.

On a Desktop install the harness lives inside `app.asar`, which a plain Node
runtime cannot read. Run the smoke test through the app's own runtime instead:

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
$env:DSH_NODE_MODULES = 'D:\Program Files\DeepseekHarness\resources\app.asar\dsh\node_modules'
& 'D:\Program Files\DeepseekHarness\DeepSeek Harness.exe' test/smoke.test.mjs
```

## Updating upstream skills

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-upstream.ps1
```

The script clones upstream, replaces `skills/`, re-applies the DSH adaptations,
and rewrites `UPSTREAM.md`; review the diff, then bump `version` and the
`upstream` fields in `package.json`.

## Known limitations

- **Bash scripts:** `subagent-driven-development/scripts/*` and
  `find-polluter.sh` are bash; on Windows use Git Bash/WSL or rewrite the
  convenience logic. The skills' workflows do not depend on them.
- **Subagent model routing:** DSH's `subagent` tool has no per-dispatch `model`
  argument; steps that demand an explicit model are skipped (documented in
  `references/dsh-tools.md`).
- **No native worktree tool:** `using-git-worktrees` always takes its git
  worktree fallback path.
- **Do not mount twice:** two instances in the same layer collide on the
  `superpowers:bootstrap` section name. Remove any older file-patch row before
  installing this bundle.

## License

MIT, matching upstream. Upstream skill copyright belongs to
[Jesse Vincent](https://github.com/obra); see [LICENSE](LICENSE).
