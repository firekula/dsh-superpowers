/**
 * Minimal SKILL.md frontmatter parser for the superpowers adapter.
 *
 * Zero-dependency by design: the plugin is loaded from an absolute path by
 * the Cordis loader, so it cannot resolve bare package imports (like the
 * `yaml` package) from the harness. This module parses exactly the frontmatter
 * shape the superpowers skills use:
 *
 *   ---
 *   name: brainstorming
 *   description: "..."
 *   whenToUse: ...        (optional; superpowers does not use it today)
 *   ---
 *   <body>
 *
 * Values may be plain scalars or double-quoted strings with the usual YAML
 * escapes. The `---` fence must open the file; the first closing fence ends
 * the frontmatter.
 */

/** Matches the opening `---` line, the fields block, and the closing fence. */
const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** kebab-case skill-name grammar, aligned with @deepseek-ai/dsh-skill. */
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Unescape a double-quoted YAML scalar (the subset superpowers uses).
 * @param {string} raw - the inner text of a double-quoted scalar.
 * @returns {string} the decoded value.
 */
function unescapeDoubleQuoted(raw) {
  return raw.replace(/\\(["\\/bfnrt])/g, (_, char) => {
    switch (char) {
      case 'b': return '\b';
      case 'f': return '\f';
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      default: return char;
    }
  });
}

/**
 * Parse a single-line YAML scalar value.
 * @param {string} text - the raw value text after `key:`.
 * @returns {string | undefined} the scalar value, or undefined when the
 *   value is not a supported single-line scalar.
 */
function parseScalar(text) {
  let value = text.trim();
  if (value === '') return undefined;
  if (value.startsWith('"')) {
    // Double-quoted: find the terminating unescaped quote.
    let end = -1;
    for (let i = 1; i < value.length; i += 1) {
      if (value[i] === '\\') { i += 1; continue; }
      if (value[i] === '"') { end = i; break; }
    }
    if (end === -1 || value.slice(end + 1).trim() !== '') return undefined;
    return unescapeDoubleQuoted(value.slice(1, end));
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) return undefined;
    return value.slice(1, -1).replace(/''/g, "'");
  }
  // Plain scalar: strip a trailing ` # comment` and trim again.
  const hash = value.indexOf(' #');
  if (hash !== -1) value = value.slice(0, hash).trim();
  return value;
}

/**
 * Parse a `SKILL.md`-style document.
 * @param {string} text - full file content.
 * @returns {{ name: string, description: string, whenToUse?: string, body: string }}
 * @throws {Error} when the frontmatter is missing or a required field is invalid.
 */
export function parseSkillMarkdown(text) {
  const match = FRONTMATTER_RE.exec(text);
  if (match === null) {
    throw new Error('SKILL.md must start with a --- frontmatter block');
  }
  const fields = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (/^[ \t]/.test(line)) {
      // Folded multi-line values are not used by superpowers; stop parsing
      // rather than guess, so malformed files fail loudly.
      break;
    }
    const field = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(line);
    if (field === null) break;
    const value = parseScalar(field[2]);
    if (value === undefined) break;
    fields.set(field[1], value);
  }
  const name = fields.get('name');
  if (typeof name !== 'string' || !SKILL_NAME_RE.test(name)) {
    throw new Error(`invalid skill name ${JSON.stringify(name)}`);
  }
  const description = fields.get('description');
  if (typeof description !== 'string' || description.trim() === '') {
    throw new Error(`skill "${name}" requires a non-empty description`);
  }
  const whenToUse = fields.get('whenToUse');
  return {
    name,
    description,
    ...(typeof whenToUse === 'string' && whenToUse.trim() !== '' ? { whenToUse } : {}),
    body: text.slice(match[0].length),
  };
}
