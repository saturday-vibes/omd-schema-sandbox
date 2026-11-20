// Decides what a change to component/ or service/ releases.
//
//   node scripts/check-release.mjs check --base origin/main [--markdown out.md]
//     PR check. Exits 1 when a kind's files changed without a valid version bump.
//
//   node scripts/check-release.mjs pending
//     Prints the kinds whose package.json version has no tag yet, as JSON.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import AjvModule from 'ajv';
import ajvErrorsModule from 'ajv-errors';

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

function readJson(ref, file) {
  try {
    return JSON.parse(ref ? git('show', `${ref}:${file}`) : fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function compareVersions(a, b) {
  const [x, y] = [SEMVER.exec(a).slice(1).map(Number), SEMVER.exec(b).slice(1).map(Number)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

function latestTag(kind) {
  return git('tag', '-l', `${kind}-v*`)
    .split('\n')
    .map(tag => tag.slice(`${kind}-v`.length))
    .filter(v => SEMVER.test(v))
    .sort(compareVersions)
    .at(-1);
}

/** Files the package ships (its `files` and package.json) that differ from the base. */
function changedFiles(base, dir, pkg) {
  const shipped = [...(pkg.files ?? []), 'package.json'].map(f => `${dir}/${f}`);
  return git('diff', '--name-only', base, '--', ...shipped).split('\n').filter(Boolean);
}

export function checkKind(kind, base) {
  const { dir, schema } = KINDS[kind];
  const pkg = readJson(undefined, `${dir}/package.json`);
  const basePkg = readJson(base, `${dir}/package.json`);
  const result = { kind, name: pkg.name, from: basePkg?.version, to: pkg.version, errors: [] };

  const changed = changedFiles(base, dir, pkg);
  if (changed.length === 0) {
    result.status = 'unchanged';
    return result;
  }

  const previous = [basePkg?.version, latestTag(kind)].filter(v => v && SEMVER.test(v)).sort(compareVersions).at(-1);
  if (!SEMVER.test(pkg.version)) {
    result.errors.push(`version ${pkg.version} must be plain X.Y.Z`);
  } else if (previous && compareVersions(pkg.version, previous) <= 0) {
    result.errors.push(`${changed.join(', ')} changed: bump the version in ${dir}/package.json above ${previous}`);
  }

  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    ajvErrors(ajv);
    ajv.compile(readJson(undefined, `${dir}/${schema}`));
  } catch (error) {
    result.errors.push(`${dir}/${schema} does not compile: ${error.message}`);
  }

  result.status = result.errors.length ? 'fail' : 'release';
  return result;
}

export function pending() {
  return Object.entries(KINDS).flatMap(([kind, { dir, schema }]) => {
    const pkg = readJson(undefined, `${dir}/package.json`);
    const tag = `${kind}-v${pkg.version}`;
    if (git('tag', '-l', tag).trim()) return [];
    const previous = latestTag(kind);
    return [{ kind, dir, schema, name: pkg.name, version: pkg.version, tag, previousTag: previous ? `${kind}-v${previous}` : '' }];
  });
}

export function toMarkdown(results) {
  const lines = ['<!-- check-release -->', '### Schema release check', ''];
  for (const r of results) {
    if (r.status === 'unchanged') {
      lines.push(`**${r.kind}**: no change`);
    } else if (r.status === 'release') {
      lines.push(`**${r.kind}** ${r.from} → ${r.to}: on merge, publish \`${r.name}@${r.to}\` and tag \`${r.kind}-v${r.to}\``);
    } else {
      lines.push(`**${r.kind}** ${r.from} → ${r.to}: **FAIL**`, ...r.errors.map(e => `- ${e}`));
    }
    lines.push('');
  }
  return lines.join('\n');
}

function main([command, ...rest]) {
  const flag = name => {
    const index = rest.indexOf(`--${name}`);
    return index === -1 ? undefined : rest[index + 1];
  };
  if (command === 'pending') {
    process.stdout.write(`${JSON.stringify(pending())}\n`);
    return 0;
  }
  if (command === 'check') {
    const results = Object.keys(KINDS).map(kind => checkKind(kind, flag('base') ?? 'origin/main'));
    const markdown = toMarkdown(results);
    if (flag('markdown')) fs.writeFileSync(flag('markdown'), markdown);
    process.stdout.write(`${markdown}\n`);
    return results.some(r => r.status === 'fail') ? 1 : 0;
  }
  process.stderr.write('usage: check-release.mjs check --base <ref> [--markdown <file>] | pending\n');
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
