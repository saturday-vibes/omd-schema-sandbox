// Decides what a change to component/ or service/ releases.
//
//   node scripts/check-release.mjs check --base origin/main [--markdown out.md] [--offline]
//     PR check. Exits 1 when a kind's change can't be released as it is.
//
//   node scripts/check-release.mjs pending
//     Prints the kinds whose package.json version has no tag yet, as JSON.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import AjvModule from 'ajv';
import ajvErrorsModule from 'ajv-errors';
import yaml from 'js-yaml';
import { diffSchemas, rank } from './lib/schema-diff.mjs';

const Ajv = AjvModule.default ?? AjvModule;
const ajvErrors = ajvErrorsModule.default ?? ajvErrorsModule;

export const KINDS = {
  component: { dir: 'component', schema: 'OmdComponent.json' },
  service: { dir: 'service', schema: 'OmdService.json' },
};

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function readAt(ref, file) {
  try {
    return ref ? git('show', `${ref}:${file}`) : fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

function parseVersion(version) {
  const match = SEMVER.exec(version ?? '');
  return match ? match.slice(1).map(Number) : undefined;
}

function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

function nextVersions(version) {
  const [major, minor, patch] = parseVersion(version);
  return {
    patch: `${major}.${minor}.${patch + 1}`,
    minor: `${major}.${minor + 1}.0`,
    major: `${major + 1}.0.0`,
  };
}

function taggedVersions(kind) {
  return git('tag', '-l', `${kind}-v*`)
    .split('\n')
    .map(tag => tag.slice(`${kind}-v`.length))
    .filter(parseVersion)
    .sort(compareVersions);
}

function publishedOnRegistry(name, version) {
  try {
    const out = execFileSync('npm', ['view', `${name}@${version}`, 'version', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.trim().length > 0;
  } catch (error) {
    if (String(error.stdout ?? '').includes('E404') || String(error.stderr ?? '').includes('E404')) {
      return false;
    }
    throw new Error(`could not check ${name}@${version} on the registry: ${error.message}`);
  }
}

/** Hash of what the package ships: the `files`, plus package.json without its version. */
function contentHash(ref, kind, pkg) {
  const { dir } = KINDS[kind];
  const hash = createHash('sha256');
  const { version: _version, ...rest } = pkg;
  hash.update(JSON.stringify(rest));
  for (const file of [...(pkg.files ?? [])].sort()) {
    hash.update(`\0${file}\0${readAt(ref, path.posix.join(dir, file)) ?? '<missing>'}`);
  }
  return hash.digest('hex');
}

function compileErrors(schema) {
  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    ajvErrors(ajv);
    ajv.compile(schema);
    return [];
  } catch (error) {
    return [`schema does not compile: ${error.message}`];
  }
}

function sampleErrors(kind, version) {
  const file = path.join(KINDS[kind].dir, 'sample', 'now.yaml');
  const text = readAt(undefined, file);
  if (text === undefined) return [`${file} is missing`];
  const declared = yaml.load(text)?.schema_version;
  return declared === `v${version}`
    ? []
    : [`${file} has schema_version ${declared}, expected v${version}`];
}

export function checkKind(kind, { base, offline = false }) {
  const { dir, schema: schemaFile } = KINDS[kind];
  const headPkg = JSON.parse(readAt(undefined, `${dir}/package.json`));
  const baseText = readAt(base, `${dir}/package.json`);
  const basePkg = baseText ? JSON.parse(baseText) : undefined;
  const result = {
    kind,
    name: headPkg.name,
    from: basePkg?.version,
    to: headPkg.version,
    errors: [],
    changes: [],
  };

  if (!basePkg) {
    const latest = taggedVersions(kind).at(-1);
    result.status = headPkg.version === latest ? 'introduced' : 'fail';
    if (result.status === 'fail') {
      result.errors.push(`a new ${dir}/package.json must start at the latest tagged version (${latest ?? 'none'})`);
    }
    return result;
  }

  const contentChanged = contentHash(base, kind, basePkg) !== contentHash(undefined, kind, headPkg);
  const versionChanged = basePkg?.version !== headPkg.version;

  if (!contentChanged && !versionChanged) {
    result.status = 'unchanged';
    return result;
  }
  if (contentChanged && !versionChanged) {
    result.status = 'fail';
    result.errors.push(`${dir}/ changed but the version in ${dir}/package.json is still ${headPkg.version}. Bump it.`);
    return result;
  }
  if (!contentChanged && versionChanged) {
    result.status = 'fail';
    result.errors.push(`the version changed to ${headPkg.version} but nothing the package ships changed, so there is nothing to release.`);
    return result;
  }

  const version = headPkg.version;
  if (!parseVersion(version)) {
    result.status = 'fail';
    result.errors.push(`version ${version} must be plain X.Y.Z`);
    return result;
  }

  const tags = taggedVersions(kind);
  const previous = [basePkg?.version, tags.at(-1)]
    .filter(parseVersion)
    .sort(compareVersions)
    .at(-1);

  if (previous) {
    const allowed = nextVersions(previous);
    result.bump = Object.keys(allowed).find(level => allowed[level] === version);
    if (compareVersions(version, previous) <= 0) {
      result.errors.push(`version ${version} must be higher than ${previous}`);
    } else if (!result.bump) {
      result.errors.push(`version ${version} skips a number; after ${previous} use ${Object.values(allowed).join(', ')}`);
    }
  }
  if (tags.includes(version)) {
    result.errors.push(`tag ${kind}-v${version} already exists`);
  }
  if (!offline && publishedOnRegistry(headPkg.name, version)) {
    result.errors.push(`${headPkg.name}@${version} is already published`);
  }

  const newSchema = JSON.parse(readAt(undefined, `${dir}/${schemaFile}`));
  const oldText = readAt(base, `${dir}/${schemaFile}`);
  const diff = diffSchemas(oldText ? JSON.parse(oldText) : {}, newSchema);
  result.changes = diff.changes;
  result.required = diff.level === 'none' ? 'patch' : diff.level;
  if (result.bump && rank(result.bump) < rank(result.required)) {
    result.errors.push(`this is a ${result.bump} bump, but the schema change needs at least ${result.required}`);
  }

  result.errors.push(...compileErrors(newSchema), ...sampleErrors(kind, version));
  result.status = result.errors.length ? 'fail' : 'release';
  return result;
}

export function pending() {
  return Object.entries(KINDS).flatMap(([kind, { dir, schema }]) => {
    const pkg = JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf8'));
    const tag = `${kind}-v${pkg.version}`;
    const previous = taggedVersions(kind).at(-1);
    if (git('tag', '-l', tag).trim()) return [];
    return [{ kind, dir, schema, name: pkg.name, version: pkg.version, tag, previousTag: previous ? `${kind}-v${previous}` : '' }];
  });
}

export function toMarkdown(results) {
  const lines = ['<!-- check-release -->', '### Schema release check', ''];
  for (const r of results) {
    if (r.status === 'unchanged') {
      lines.push(`**${r.kind}**: no change`, '');
      continue;
    }
    if (r.status === 'introduced') {
      lines.push(`**${r.kind}**: package \`${r.name}\` introduced at ${r.to} (already tagged; publish existing tags with the backfill workflow)`, '');
      continue;
    }
    const verdict = r.status === 'release' ? 'OK' : 'FAIL';
    const bump = r.bump ? ` (${r.bump})` : '';
    const required = r.required ? `, smallest allowed: ${r.required}` : '';
    lines.push(`**${r.kind}** ${r.from ?? 'new'} → ${r.to}${bump}: **${verdict}**${required}`, '');
    for (const error of r.errors) lines.push(`- **error:** ${error}`);
    for (const c of r.changes) {
      const review = c.review ? ' — not analysed, review by hand' : '';
      lines.push(`- \`${c.level}\` \`${c.path}\` ${c.text}${review}`);
    }
    if (r.status === 'release') {
      lines.push('', `On merge: publish \`${r.name}@${r.to}\`, tag \`${r.kind}-v${r.to}\``);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function main(argv) {
  const [command, ...rest] = argv;
  const flag = name => {
    const index = rest.indexOf(`--${name}`);
    return index === -1 ? undefined : rest[index + 1];
  };

  if (command === 'pending') {
    process.stdout.write(`${JSON.stringify(pending())}\n`);
    return 0;
  }
  if (command === 'check') {
    const base = flag('base') ?? 'origin/main';
    const offline = rest.includes('--offline');
    const results = Object.keys(KINDS).map(kind => checkKind(kind, { base, offline }));
    const markdown = toMarkdown(results);
    const out = flag('markdown');
    if (out) fs.writeFileSync(out, markdown);
    process.stdout.write(`${markdown}\n`);
    return results.some(r => r.status === 'fail') ? 1 : 0;
  }
  process.stderr.write('usage: check-release.mjs check --base <ref> [--markdown <file>] [--offline] | pending\n');
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 3;
  }
}
