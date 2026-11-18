/**
 * Packaging test for the dsh-superpowers bundle.
 *
 * Verifies the files the DSH loader and Plugin Manager read before any DSH
 * installation is involved: the bundle manifest, the patch layer, display
 * metadata and artwork, and the shipped skill tree. It is intentionally
 * self-contained (Node builtins only) so it runs in a fresh clone.
 *
 * Run: node test/bundle.test.mjs
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills, DEFAULT_SKILLS_DIR } from '../index.js';
import { buildBootstrapSection } from '../lib/bootstrap.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}
function json(rel) {
  return JSON.parse(read(rel));
}

// ── manifest ───────────────────────────────────────────────────────────────
let manifest = {};
try {
  manifest = json('package.json');
  check('package.json parses', true);
} catch (error) {
  check('package.json parses', false, error.message);
}

check('package name is the scoped bundle name', manifest.name === '@firekula/dsh-superpowers', String(manifest.name));
check('package version is semver', /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version ?? ''), String(manifest.version));
check('package description is set', typeof manifest.description === 'string' && manifest.description.length > 20);
check('package is an ES module', manifest.type === 'module');
check('package declares no install lifecycle scripts',
  !['preinstall', 'install', 'postinstall', 'prepare'].some((key) => typeof manifest.scripts?.[key] === 'string'),
  JSON.stringify(manifest.scripts));
check('repository points at firekula/dsh-superpowers',
  typeof manifest.repository?.url === 'string'
  && manifest.repository.url.includes('github.com/firekula/dsh-superpowers'),
  String(manifest.repository?.url));
check('bundle manifest declares dsh.bundle.patch',
  manifest.dsh?.bundle?.patch === './cordis.patch.yml', String(manifest.dsh?.bundle?.patch));
check('bundle restricts no host platform', manifest.dsh?.bundle?.platforms === undefined);
check('package exports the runtime entry', manifest.exports?.['.'] === './index.js', String(manifest.exports?.['.']));
check('package exports locale JSON', manifest.exports?.['./locale/*.json'] === './locale/*.json');
check('package exports the icon', manifest.exports?.['./icon'] === './icon.svg', String(manifest.exports?.['./icon']));
check('package.json declares the icon', manifest.icon === './icon.svg', String(manifest.icon));

const files = Array.isArray(manifest.files) ? manifest.files : [];
for (const entry of ['index.js', 'lib/', 'skills/', 'cordis.patch.yml', 'locale/*.json', 'icon.svg', 'adaptations/', 'scripts/', 'test/']) {
  check(`files[] ships ${entry}`, files.includes(entry), files.join(', '));
}
check('files[] ships the READMEs', files.includes('README.md') && files.includes('README.zh.md'));
check('files[] ships LICENSE and UPSTREAM.md', files.includes('LICENSE') && files.includes('UPSTREAM.md'));
check('no legacy installer scripts ship', !existsSync(join(ROOT, 'install.ps1')) && !existsSync(join(ROOT, 'install.sh'))
  && !existsSync(join(ROOT, 'install.bat')) && !existsSync(join(ROOT, 'uninstall.bat')) && !existsSync(join(ROOT, 'verify.bat')));

// ── patch layer ────────────────────────────────────────────────────────────
const patch = existsSync(join(ROOT, 'cordis.patch.yml')) ? read('cordis.patch.yml') : '';
// Comments may explain why a row must not use a file:// URL; check the YAML body.
const patchBody = patch.split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join('\n');
check('cordis.patch.yml exists', patch.length > 0);
check('patch inserts a row', /^\s*-?\s*insert:\s*$/m.test(patchBody), patchBody.slice(0, 120));
check('patch row id is superpowers', /^\s*-\s*id:\s*superpowers\s*$/m.test(patchBody), patchBody);
check('patch row names the installed package', /^\s*name:\s*['"]?@firekula\/dsh-superpowers['"]?\s*$/m.test(patchBody), patchBody);
check('patch uses no file:// URL', !/file:\/\//.test(patchBody));
check('patch uses no absolute Windows path', !/[A-Za-z]:[\\/]/.test(patchBody));

// ── display metadata ───────────────────────────────────────────────────────
for (const locale of ['en', 'zh']) {
  let meta = {};
  try {
    meta = json(`locale/${locale}.json`);
    check(`locale/${locale}.json parses`, true);
  } catch (error) {
    check(`locale/${locale}.json parses`, false, error.message);
  }
  check(`locale/${locale} has meta.title`, typeof meta.meta?.title === 'string' && meta.meta.title.length > 0);
  check(`locale/${locale} has meta.description`, typeof meta.meta?.description === 'string' && meta.meta.description.length > 30);
  check(`locale/${locale} discloses the prompt cost`, /4\s*KB/.test(meta.meta?.description ?? ''));
  if (meta.meta?.detail !== undefined) {
    check(`locale/${locale} detail document exists`, existsSync(join(ROOT, meta.meta.detail)), String(meta.meta.detail));
  }
}

const enMeta = json('locale/en.json').meta ?? {};
const zhMeta = json('locale/zh.json').meta ?? {};
check('English detail uses the English README', enMeta.detail === 'README.md', String(enMeta.detail));
check('Chinese detail uses the Chinese README', zhMeta.detail === 'README.zh.md', String(zhMeta.detail));
check('titles describe a skill library in both locales',
  /skill/i.test(enMeta.title ?? '') && /技能/.test(zhMeta.title ?? ''), `${enMeta.title} / ${zhMeta.title}`);

// ── artwork ────────────────────────────────────────────────────────────────
const icon = existsSync(join(ROOT, 'icon.svg')) ? read('icon.svg') : '';
check('icon.svg exists', icon.length > 0);
check('icon.svg is 36x36 with a viewBox', /width="36"/.test(icon) && /height="36"/.test(icon) && /viewBox="0 0 36 36"/.test(icon));
check('icon.svg is self-contained', !/<script/i.test(icon) && !/<style/i.test(icon) && !/<text/i.test(icon)
  && !/<image/i.test(icon) && !/<foreignObject/i.test(icon) && !/\son[a-z]+=/i.test(icon));
check('icon.svg references no external resources',
  !/\b(?:href|src)\s*=\s*["']?\s*(?:https?:)?\/\//i.test(icon)
  && !/url\(\s*['"]?\s*(?:https?:)?\/\//i.test(icon)
  && !/xlink:href/i.test(icon));
check('icon.svg stays under 256 KiB', existsSync(join(ROOT, 'icon.svg')) && statSync(join(ROOT, 'icon.svg')).size < 256 * 1024);

// ── shipped skills ─────────────────────────────────────────────────────────
const skills = discoverSkills(DEFAULT_SKILLS_DIR);
const names = skills.map((skill) => skill.name).sort();
check('14 skill bundles ship', names.length === 14, `got ${names.length}`);
check('shipped skill names match the catalog', JSON.stringify(names) === JSON.stringify(EXPECTED_SKILLS), names.join(', '));
check('skill bodies carry no marketplace prefix', skills.every((skill) => !/\bsuperpowers:/.test(skill.content)));
check('skill bodies carry directory resourceBase', skills.every((skill) => skill.resourceBase?.kind === 'directory'
  && existsSync(skill.resourceBase.path)));
check('using-superpowers ships the DSH tool mapping', existsSync(join(DEFAULT_SKILLS_DIR, 'using-superpowers', 'references', 'dsh-tools.md')));

const bootstrapBytes = Buffer.byteLength(buildBootstrapSection(skills), 'utf8');
check('bootstrap size matches the disclosed ~4 KB', bootstrapBytes > 3500 && bootstrapBytes < 4500, `${bootstrapBytes} bytes`);

// ── docs and provenance ────────────────────────────────────────────────────
const readme = existsSync(join(ROOT, 'README.md')) ? read('README.md') : '';
const readmeZh = existsSync(join(ROOT, 'README.zh.md')) ? read('README.zh.md') : '';
check('README.md exists', readme.length > 0);
check('README.zh.md exists', readmeZh.length > 0);
for (const [label, text] of [['README.md', readme], ['README.zh.md', readmeZh]]) {
  check(`${label} documents the CLI install`, text.includes('dsh plugin --profile'));
  check(`${label} documents the git source`, text.includes('github:firekula/dsh-superpowers'));
  check(`${label} documents uninstalling`, /uninstall|remove|卸载|移除/i.test(text));
  check(`${label} uses the scoped package name for removal`, text.includes('@firekula/dsh-superpowers'));
}
check('README.md warns about the npm name collision', /Do not install the bare npm name/.test(readme));
check('README.zh.md warns about the npm name collision', /不要用裸包名/.test(readmeZh));
check('LICENSE keeps the MIT text', /MIT License/.test(read('LICENSE')) && /Jesse Vincent/.test(read('LICENSE')));
check('UPSTREAM.md records the vendored upstream', /obra\/superpowers/.test(read('UPSTREAM.md')));
check('.gitignore ignores node_modules', existsSync(join(ROOT, '.gitignore')) && /node_modules/.test(read('.gitignore')));

console.log(failures === 0 ? '\nBUNDLE TEST PASSED' : `\nBUNDLE TEST FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
