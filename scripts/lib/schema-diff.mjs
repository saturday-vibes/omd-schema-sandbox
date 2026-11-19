// Compares two JSON Schemas and works out the smallest version bump the change
// needs: major when a document that passed the old schema can fail the new one,
// minor when the new schema only allows more, patch for wording.

export const LEVELS = ['none', 'patch', 'minor', 'major'];

export function rank(level) {
  return LEVELS.indexOf(level);
}

const WORDING = new Set([
  'title',
  'description',
  'examples',
  'errorMessage',
  '$comment',
  'default',
]);

const LOWER_BOUNDS = new Set(['minimum', 'exclusiveMinimum', 'minLength', 'minItems', 'minProperties']);
const UPPER_BOUNDS = new Set(['maximum', 'exclusiveMaximum', 'maxLength', 'maxItems', 'maxProperties']);
const TIGHTENING_ONLY = new Set(['pattern', 'format', 'const', 'uniqueItems']);

/**
 * @returns {{ level: string, changes: { level: string, path: string, text: string, review?: boolean }[] }}
 */
export function diffSchemas(oldSchema, newSchema) {
  const changes = [];
  compare(oldSchema ?? {}, newSchema ?? {}, '', changes);
  const level = changes.reduce(
    (highest, change) => (rank(change.level) > rank(highest) ? change.level : highest),
    'none',
  );
  return { level, changes };
}

function compare(oldNode, newNode, path, changes) {
  if (!isObject(oldNode) || !isObject(newNode)) {
    if (!equal(oldNode, newNode)) {
      changes.push({ level: 'minor', path: path || '/', text: 'changed', review: true });
    }
    return;
  }

  const keys = new Set([...Object.keys(oldNode), ...Object.keys(newNode)]);
  for (const key of keys) {
    const before = oldNode[key];
    const after = newNode[key];
    if (equal(before, after)) continue;
    const at = `${path}/${key}`;

    if (WORDING.has(key)) {
      changes.push({ level: 'patch', path: at, text: 'wording' });
    } else if (key === 'properties') {
      compareProperties(before ?? {}, after ?? {}, path, changes);
    } else if (key === 'required') {
      compareSets(before ?? [], after ?? [], at, changes, {
        added: 'major',
        addedText: v => `now required: ${v}`,
        removed: 'minor',
        removedText: v => `no longer required: ${v}`,
      });
    } else if (key === 'enum') {
      compareSets(before ?? [], after ?? [], at, changes, {
        added: 'minor',
        addedText: v => `+ ${JSON.stringify(v)}`,
        removed: 'major',
        removedText: v => `- ${JSON.stringify(v)}`,
      });
    } else if (key === 'type') {
      const was = [before ?? []].flat();
      const now = [after ?? []].flat();
      const widened = before === undefined || was.every(t => now.includes(t));
      changes.push({
        level: widened && after !== undefined ? 'minor' : 'major',
        path: at,
        text: `type ${JSON.stringify(before)} → ${JSON.stringify(after)}`,
      });
    } else if (key === 'additionalProperties') {
      compareAdditional(before, after, at, changes);
    } else if (key === 'items') {
      compare(before ?? {}, after ?? {}, at, changes);
    } else if (LOWER_BOUNDS.has(key) || UPPER_BOUNDS.has(key)) {
      changes.push({ level: boundLevel(key, before, after), path: at, text: `${before} → ${after}` });
    } else if (TIGHTENING_ONLY.has(key)) {
      const level = after === undefined ? 'minor' : 'major';
      changes.push({ level, path: at, text: `${JSON.stringify(before)} → ${JSON.stringify(after)}` });
    } else {
      changes.push({ level: 'minor', path: at, text: 'changed, not analysed', review: true });
    }
  }
}

function compareProperties(before, after, path, changes) {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const name of names) {
    const at = `${path}/properties/${name}`;
    if (!(name in after)) {
      changes.push({ level: 'major', path: at, text: 'removed' });
    } else if (!(name in before)) {
      changes.push({ level: 'minor', path: at, text: 'added' });
    } else {
      compare(before[name], after[name], at, changes);
    }
  }
}

function compareSets(before, after, at, changes, rules) {
  for (const value of after) {
    if (!before.some(v => equal(v, value))) {
      changes.push({ level: rules.added, path: at, text: rules.addedText(value) });
    }
  }
  for (const value of before) {
    if (!after.some(v => equal(v, value))) {
      changes.push({ level: rules.removed, path: at, text: rules.removedText(value) });
    }
  }
}

function compareAdditional(before, after, at, changes) {
  const allowsAll = v => v === undefined || v === true;
  if (isObject(before) && isObject(after)) {
    compare(before, after, at, changes);
  } else if (allowsAll(after)) {
    changes.push({ level: 'minor', path: at, text: 'relaxed' });
  } else {
    changes.push({ level: 'major', path: at, text: 'tightened' });
  }
}

function boundLevel(key, before, after) {
  if (before === undefined) return 'major';
  if (after === undefined) return 'minor';
  const tighter = LOWER_BOUNDS.has(key) ? after > before : after < before;
  return tighter ? 'major' : 'minor';
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function equal(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
