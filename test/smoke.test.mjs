/**
 * Standalone smoke test for dsh-superpowers.
 *
 * Boots a bare Cordis context with the REAL `SkillRegistry`
 * (`@deepseek-ai/dsh-skill`) and `SystemPrompt`
 * (`@deepseek-ai/dsh-system-prompt`) services taken from a DeepSeek Harness
 * installation's node_modules (set DSH_NODE_MODULES to override the
 * auto-detection), mounts this plugin, and asserts the observable contract:
 *
 *   - all 14 vendored skill bundles register with valid names/descriptions;
 *   - `skills.get()` returns complete bodies with a directory resourceBase;
 *   - cross-references carry no `superpowers:` prefix;
 *   - the bootstrap system-prompt section assembles with the
 *     `<EXTREMELY_IMPORTANT>` envelope;
 *   - the DSH platform reference file ships beside using-superpowers.
 *
 * Run: node test/smoke.test.mjs
 */
import { pathToFileURL } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/** Locate a DeepSeek Harness installation's node_modules (npx cache, global npm, ~/.npm). */
function findDshNodeModules() {
  if (process.env.DSH_NODE_MODULES) return process.env.DSH_NODE_MODULES;
  const candidates = [];
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const npxRoot = join(localAppData, 'npm-cache', '_npx');
    if (existsSync(npxRoot)) {
      for (const entry of readdirSync(npxRoot)) {
        const nodeModules = join(npxRoot, entry, 'node_modules');
        if (existsSync(nodeModules)) candidates.push(nodeModules);
      }
    }
  }
  const appData = process.env.APPDATA;
  if (appData) candidates.push(join(appData, 'npm', 'node_modules'));
  const npmNpxRoot = join(homedir(), '.npm', '_npx');
  if (existsSync(npmNpxRoot)) {
    for (const entry of readdirSync(npmNpxRoot)) {
      const nodeModules = join(npmNpxRoot, entry, 'node_modules');
      if (existsSync(nodeModules)) candidates.push(nodeModules);
    }
  }
  return candidates.find((dir) => existsSync(join(dir, '@deepseek-ai', 'dsh-skill')));
}

const NODE_MODULES = findDshNodeModules();
if (NODE_MODULES === undefined) {
  console.error('Cannot locate a DeepSeek Harness installation (no node_modules with @deepseek-ai/dsh-skill found).');
  console.error('Set DSH_NODE_MODULES to the harness node_modules directory and retry.');
  process.exit(1);
}

const moduleUrl = (spec) => pathToFileURL(join(NODE_MODULES, spec)).href;

const { Context } = await import(moduleUrl('@deepseek-ai/cordis/lib/index.js'));
const { default: SkillRegistry } = await import(moduleUrl('@deepseek-ai/dsh-skill/lib/index.js'));
const { default: SystemPrompt } = await import(moduleUrl('@deepseek-ai/dsh-system-prompt/lib/index.js'));

const pluginModule = await import('../index.js');
const {
  name: pluginName,
  inject: pluginInject,
  apply: pluginApply,
  discoverSkills,
  DEFAULT_SKILLS_DIR,
  BOOTSTRAP_SECTION,
} = pluginModule;
const { parseSkillMarkdown } = await import('../lib/frontmatter.js');

const EXPECTED_SKILLS = [
  'brainstorming',
  'dispatching-parallel-agents',
  'executing-plans',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-git-worktrees',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
  'writing-skills',
];

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok - ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${label}${detail ? `: ${detail}` : ''}`);
  }
}

// ── pure-unit: frontmatter parsing ─────────────────────────────────────────
{
  const parsed = parseSkillMarkdown(
    '---\nname: demo-skill\ndescription: "A \\"quoted\\" description"\n---\n\n# Body\n',
  );
  check('parseSkillMarkdown: name/description/quotes', parsed.name === 'demo-skill'
    && parsed.description === 'A "quoted" description' && parsed.body === '\n# Body\n');
  const bad = () => parseSkillMarkdown('no frontmatter here');
  check('parseSkillMarkdown: rejects missing frontmatter', (() => { try { bad(); return false; } catch { return true; } })());
}

// ── pure-unit: discovery against the vendored tree ─────────────────────────
{
  const skills = discoverSkills(DEFAULT_SKILLS_DIR);
  const names = skills.map((skill) => skill.name).sort();
  check('discoverSkills: finds 14 bundles', names.length === 14, `got ${names.length}`);
  check('discoverSkills: expected names', JSON.stringify(names) === JSON.stringify(EXPECTED_SKILLS), names.join(', '));
  for (const skill of skills) {
    const okBody = typeof skill.content === 'string' && skill.content.length > 100;
    const okBase = skill.resourceBase.kind === 'directory' && existsSync(skill.resourceBase.path);
    const okFile = existsSync(skill.path);
    const noPrefix = !/\bsuperpowers:/.test(skill.content);
    check(`discoverSkills: ${skill.name} body/resourceBase/file/prefix`, okBody && okBase && okFile && noPrefix);
  }
  const empty = discoverSkills(join(DEFAULT_SKILLS_DIR, 'does-not-exist'), { warn() {} });
  check('discoverSkills: missing root yields []', empty.length === 0);
}

// ── integration: mount against the real registries ─────────────────────────
{
  const root = new Context();
  await root.plugin(SkillRegistry);
  await root.plugin(SystemPrompt);
  await root.plugin({ name: pluginName, inject: pluginInject, apply: pluginApply });

  const list = await root.skills.list();
  check('registry: 14 skills listed', list.length === 14, `got ${list.length}`);
  check('registry: sorted names', JSON.stringify(list.map((s) => s.name)) === JSON.stringify(EXPECTED_SKILLS));

  const brainstorming = await root.skills.get('brainstorming');
  check('registry: get(brainstorming) returns body', typeof brainstorming?.content === 'string'
    && brainstorming.content.includes('# Brainstorming'), 'content missing');
  check('registry: get() carries source/provider/resourceBase',
    brainstorming?.source === 'bundled'
    && brainstorming?.provider === 'runtime'
    && brainstorming?.resourceBase?.kind === 'directory');

  const using = await root.skills.get('using-superpowers');
  const dshRef = existsSync(join(using.resourceBase.path, 'references', 'dsh-tools.md'));
  check('using-superpowers: dsh-tools.md ships beside the skill', dshRef);
  check('using-superpowers: DSH entry in Platform Adaptation',
    using.content.includes('DeepSeek Harness (DSH): `references/dsh-tools.md`'));

  const assembly = await root.systemPrompt.assemble();
  const section = assembly.sections.find((entry) => entry.name === BOOTSTRAP_SECTION);
  check('systemPrompt: bootstrap section registered', section !== undefined);
  check('systemPrompt: bootstrap envelope', section?.text.includes('<EXTREMELY_IMPORTANT>')
    && section?.text.includes('You have superpowers.'));
  check('systemPrompt: bootstrap names DSH tool mapping', section?.text.includes('references/dsh-tools.md'));
  check('systemPrompt: bootstrap carries prefix-free references', section !== undefined && !/\bsuperpowers:/.test(section.text));

  await root.fiber.dispose();
}

console.log(failures === 0 ? '\nSMOKE TEST PASSED' : `\nSMOKE TEST FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
