# DeepSeek Harness (DSH) platform notes

Superpowers skills are written platform-agnostically; this file maps the
conventions they assume onto the DeepSeek Harness tool surface. Read it once
when you first load the `using-superpowers` skill, then follow the skills
normally.

## Skill loading

- Skills are loaded with the `skill` tool, using the exact kebab-case name
  from the available-skills catalog (e.g. `brainstorming`).
- DSH skill names carry no `superpowers:` prefix. When a skill body says
  `superpowers:<name>`, load `<name>`.
- The catalog lists names and descriptions only. Load a skill before
  following its instructions — never approximate one from memory.

## Subagent dispatch

DSH has two delegation tools:

- `subagent` — spawns a fresh child with a clean context. This is the
  subagent-driven-development implementer/reviewer default: craft the full
  brief yourself, never hand over session history.
- `subagent_fork` — forks a child that inherits this conversation. Use it
  for review-of-my-own-work or when the child genuinely needs this session's
  context.

Lifecycle rules:

- Both tools run in the background by default and report completion
  automatically (a runtime notice reaches you when the child settles). Do
  not poll or sleep waiting for a child; keep working on independent steps.
- Reconcile with `list_agents`; resume a live implementer with
  `send_message` rather than re-dispatching a fresh one.
- DSH has no per-dispatch `model` argument — model routing is a
  harness-level decision. Skip the "always specify the model explicitly"
  step from the skills; note in your report which tasks wanted more capable
  reasoning instead.
- Do not dispatch multiple implementation subagents in parallel (the skills
  forbid it); independent read-only research may fan out in parallel.

## Task tracking

- `todo_write` replaces TodoWrite. It records the whole list on every call;
  mark one task `in_progress` at a time (unless work genuinely runs in
  parallel).
- Skills that say "create a todo per checklist item" translate 1:1.

## Shell and files

- On Windows the shell tool is `pwsh`; on other platforms `bash`.
- The bash scripts bundled with skills (`subagent-driven-development/scripts/*`,
  `systematic-debugging/find-polluter.sh`) run under Git Bash or WSL if
  available; otherwise re-implement their logic in PowerShell or Node. The
  skills are processes first — the scripts are conveniences, not the method.
- `read`, `write`, `edit`, `glob`, `grep` replace Read/Write/Edit/Glob/Grep.
- Long-lived helpers (e.g. the brainstorming visual-companion server) run as
  background jobs: pass `run_in_background: true`, collect output with
  `job_output`, stop with `job_kill`.

## Worktrees

DSH has no native worktree tool, so `using-git-worktrees` always uses its
manual `git worktree` fallback. Follow that skill's environment-detection
step (linked worktree / detached HEAD checks) with read-only git commands
before acting.

## Plans, approval, and questions

- DSH plan mode ends with `exit_plan_mode`, which presents the plan for
  approval. The superpowers rule stands: brainstorm before planning.
- Ask the human with `ask_user_question` for genuine user-owned choices;
  discover everything else by inspection.

## Where authored skills live on DSH

The `writing-skills` skill says personal skills live in "your runtime's
skills directory". On DSH that is:

- `~/.dsh/skills/<name>/SKILL.md` (user-level, every project), or
- `<project>/.dsh/skills/<name>/SKILL.md` (project-level, committed or not).

Both roots are discovered automatically by the `skill-filesystem` plugin;
project entries outrank user entries, and both outrank the bundled
Superpowers skills, so a local copy overrides this plugin's copy.
