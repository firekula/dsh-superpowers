/**
 * Loader-import probe: verify a plugin row's `name` specifier imports through
 * the EXACT code path DeepSeek Harness uses at boot.
 *
 * cordis-plugin-loader resolves each entry by calling either
 *   - `internal.import(specifier, baseUrl, {})` — Node's internal cascaded
 *     ESM loader obtained via `node-addon-require-builtin` (the runtime path
 *     on Node >= 22 when the addon is present), or
 *   - plain dynamic `import(specifier)`.
 *
 * The internal loader rejects Windows drive paths (`F:/...` → protocol 'f:'
 * error) — specifiers must already be valid URLs, i.e. `file:///F:/...`.
 * This probe reproduces that path so an install can fail fast instead of at
 * the next harness boot.
 *
 * Usage: node test/loader-import-probe.mjs <specifier> <dsh-node_modules>
 * Exit code: 0 = specifier imports and exports an `apply` function.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [specifier, nodeModules] = process.argv.slice(2);
if (!specifier || !nodeModules) {
  console.error('usage: node loader-import-probe.mjs <specifier> <dsh-node_modules>');
  process.exit(2);
}

const req = createRequire(pathToFileURL(`${nodeModules}/probe.js`).href);
const parentURL = pathToFileURL(nodeModules).href + '/';

let raw;
try {
  raw = req('node-addon-require-builtin')
    .requireBuiltin('internal/modules/esm/loader')
    .getOrInitializeCascadedLoader();
} catch {
  raw = undefined; // fall back to plain dynamic import (the other runtime branch)
}

try {
  const mod = raw ? await raw.import(specifier, parentURL, {}) : await import(specifier);
  const ns = mod.module?.namespace ?? mod;
  if (typeof ns !== 'object' || ns === null || typeof ns.apply !== 'function') {
    console.error(`import-succeeded but plugin shape unexpected: ${typeof ns?.apply}`);
    process.exit(1);
  }
  console.log(`import-ok: name=${ns.name} inject=${JSON.stringify(ns.inject)}`);
} catch (error) {
  console.error(`import-failed: ${error.message}`);
  process.exit(1);
}
