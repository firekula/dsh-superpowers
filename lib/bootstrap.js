/**
 * Session-start bootstrap text for the superpowers adapter.
 *
 * Mirrors the upstream `hooks/session-start` contract: inject the
 * `using-superpowers` skill body as durable context at session start, so the
 * agent checks for applicable skills BEFORE any response or action. On DSH
 * the natural carrier is a system-prompt section, which also survives
 * compaction (upstream re-injects after compaction via hook; here the
 * section is simply always present).
 */

/** Fallback when the vendored using-superpowers skill is absent (custom skill dirs). */
const FALLBACK_BODY = [
  'Invoke relevant or requested skills BEFORE any response or action — including',
  'clarifying questions, exploring the codebase, or checking files. If you think',
  'there is even a 1% chance a skill might apply to what you are doing, you',
  'ABSOLUTELY MUST invoke it. If it turns out wrong for the situation, you do not',
  'have to use it.',
  '',
  'Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it',
  'has a checklist, create a todo per item.',
].join('\n');

/**
 * Build the `<EXTREMELY_IMPORTANT>` bootstrap section text.
 * @param {Array<{ name: string, content: string }>} skills - discovered skills.
 * @returns {string} the complete section text.
 */
export function buildBootstrapSection(skills) {
  const using = skills.find((skill) => skill.name === 'using-superpowers');
  const body = (using?.content ?? FALLBACK_BODY).trim();
  return [
    '<EXTREMELY_IMPORTANT>',
    'You have superpowers.',
    '',
    'The Superpowers skills library is installed in this session. The available-skills catalog message lists every skill; load one with the `skill` tool using its exact name, then follow its full instructions.',
    '',
    'Below is the full content of the `using-superpowers` skill — your introduction to using skills:',
    '',
    body,
    '',
    'Platform notes for this harness (DeepSeek Harness):',
    '- Skill names are plain kebab-case (`brainstorming`, `systematic-debugging`), carrying no marketplace prefix.',
    '- Dispatch subagents with `subagent` (fresh context) or `subagent_fork` (inherits this conversation). Background children report completion automatically — reconcile with `list_agents`, never poll.',
    '- Track checklists with `todo_write`. The shell is `pwsh` on Windows and `bash` elsewhere.',
    '- Harness-specific tool mapping for every skill: load the `using-superpowers` skill and read its `references/dsh-tools.md`.',
    '</EXTREMELY_IMPORTANT>',
  ].join('\n');
}
