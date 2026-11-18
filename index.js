/**
 * dsh-plugin-superpowers — DeepSeek Harness adapter for obra/superpowers.
 *
 * The upstream project (https://github.com/obra/superpowers) is a skills
 * library for coding agents: 14 `SKILL.md` bundles covering brainstorming,
 * plan writing, subagent-driven development, TDD, systematic debugging,
 * code review, and branch finishing. On Claude Code it is installed as a
 * plugin that registers the skills and injects the `using-superpowers`
 * bootstrap at session start.
 *
 * This adapter does the same two things with DSH-native primitives:
 *
 *   1. Registers every skill bundle from the vendored `skills/` directory
 *      with `ctx.skills.register(...)` (the runtime-skill API of
 *      `@deepseek-ai/dsh-skill`). Each skill carries a directory
 *      `resourceBase`, so the `skill` tool tells the model where the
 *      bundle's scripts and reference files live.
 *
 *   2. Registers a `superpowers:bootstrap` system-prompt section containing
 *      the `using-superpowers` instructions, mirroring upstream's
 *      session-start hook (durable and compaction-proof on DSH).
 *
 * Zero runtime dependencies: the plugin is loaded from an absolute path by
 * the Cordis loader, where bare package imports would not resolve, so it
 * uses only node builtins.
 *
 * Environment switches (read at apply time):
 *   DSH_SUPERPOWERS_SKILL_DIR        alternative skills root
 *   DSH_SUPERPOWERS_DISABLE_BOOTSTRAP  any truthy value disables the
 *                                      system-prompt bootstrap section
 *
 * @module dsh-plugin-superpowers
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSkillMarkdown } from './lib/frontmatter.js';
import { buildBootstrapSection } from './lib/bootstrap.js';

/** Cordis plugin name. */
export const name = 'superpowers';
/** Services this plugin contributes to. */
export const inject = ['skills', 'systemPrompt'];

/** Absolute directory of this plugin package. */
export const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url));
/** Bundled skills root: `<plugin>/skills`. */
export const DEFAULT_SKILLS_DIR = join(PLUGIN_DIR, 'skills');
/** System-prompt section identity (stable so a scoped override can shadow it). */
export const BOOTSTRAP_SECTION = 'superpowers:bootstrap';
/** Prompt order: after the persona (0), before tool guidance (100+). */
export const BOOTSTRAP_ORDER = 50;

/** kebab-case grammar, aligned with @deepseek-ai/dsh-skill. */
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function envFlag(variable) {
  const value = process.env[variable];
  if (value === undefined) return false;
  return /^(1|true|yes|on)$/i.test(value);
}

/**
 * Upstream skills reference each other with the Claude marketplace prefix
 * (`superpowers:test-driven-development`); DSH names are plain kebab-case.
 * Rewrite the prefix at load time so cross-references match the catalog the
 * model actually sees. Vendored files stay pristine for easy re-sync.
 * @param {string} text - skill body.
 * @returns {string} the body with prefixes stripped.
 */
export function normalizeSkillReferences(text) {
  return text.replace(/\bsuperpowers:([a-z0-9]+(?:-[a-z0-9]+)*)/g, '$1');
}

/**
 * Discover skill bundles under `skillsDir`: one level of
 * `<skillsDir>/<name>/SKILL.md`, the same shape the DSH filesystem provider
 * recognizes. Malformed bundles are skipped with a warning so one bad file
 * cannot take down the whole plugin.
 * @param {string} skillsDir - root directory to scan.
 * @param {{ warn(message: string): void }} [logger]
 * @returns {Array<{ name: string, description: string, whenToUse?: string,
 *   content: string, path: string, resourceBase: { kind: 'directory', path: string } }>}
 */
export function discoverSkills(skillsDir, logger = console) {
  const skills = [];
  let entries = [];
  try {
    entries = readdirSync(skillsDir);
  } catch (error) {
    logger.warn(`superpowers: cannot read skills directory ${skillsDir}: ${error.message}`);
    return skills;
  }
  for (const entry of entries.sort()) {
    if (entry.startsWith('.')) continue;
    const dir = join(skillsDir, entry);
    const file = join(dir, 'SKILL.md');
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (error) {
      logger.warn(`superpowers: cannot read ${file}: ${error.message}`);
      continue;
    }
    let parsed;
    try {
      parsed = parseSkillMarkdown(text);
    } catch (error) {
      logger.warn(`superpowers: skipping malformed skill at ${file}: ${error.message}`);
      continue;
    }
    if (!SKILL_NAME_RE.test(parsed.name)) {
      logger.warn(`superpowers: skipping ${file}: invalid skill name "${parsed.name}"`);
      continue;
    }
    skills.push({
      name: parsed.name,
      description: parsed.description,
      ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
      content: normalizeSkillReferences(parsed.body),
      path: file,
      resourceBase: { kind: 'directory', path: dir },
    });
  }
  return skills;
}

/**
 * Register the vendored superpowers skills and the bootstrap section.
 * @param {import('@deepseek-ai/cordis').Context} ctx - mounting context.
 */
export function apply(ctx) {
  const skillsDir = resolve(process.env.DSH_SUPERPOWERS_SKILL_DIR ?? DEFAULT_SKILLS_DIR);
  const skills = discoverSkills(skillsDir, ctx.logger);

  for (const skill of skills) {
    ctx.effect(() => ctx.skills.register({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      // Runtime skills must carry an explicit source and provider defaults
      // to their registry-owned values on `get()`.
      source: 'bundled',
      path: skill.path,
      resourceBase: skill.resourceBase,
      ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
    }), `superpowers:skill:${skill.name}`);
  }

  if (!envFlag('DSH_SUPERPOWERS_DISABLE_BOOTSTRAP')) {
    ctx.effect(() => ctx.systemPrompt.section({
      name: BOOTSTRAP_SECTION,
      order: BOOTSTRAP_ORDER,
      text: buildBootstrapSection(skills),
    }), 'superpowers:bootstrap-section');
  }

  ctx.logger.info(`superpowers: registered ${skills.length} skill(s) from ${skillsDir}`);
}
