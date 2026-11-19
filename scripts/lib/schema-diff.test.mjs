import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { diffSchemas } from './schema-diff.mjs';

const base = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', description: 'The name' },
    tier: { type: 'string', enum: ['tier-1', 'tier-2'] },
  },
};

function change(mutate) {
  const next = structuredClone(base);
  mutate(next);
  return diffSchemas(base, next);
}

describe('diffSchemas', () => {
  it('finds nothing in identical schemas', () => {
    assert.deepEqual(diffSchemas(base, structuredClone(base)), { level: 'none', changes: [] });
  });

  it('treats wording as a patch', () => {
    const result = change(s => {
      s.properties.name.description = 'The component name';
      s.properties.name.errorMessage = 'name is required';
    });
    assert.equal(result.level, 'patch');
  });

  it('treats an optional property as minor', () => {
    const result = change(s => {
      s.properties.slack_channel = { type: 'string' };
    });
    assert.equal(result.level, 'minor');
    assert.deepEqual(result.changes[0], {
      level: 'minor',
      path: '/properties/slack_channel',
      text: 'added',
    });
  });

  it('treats a new required property as major', () => {
    const result = change(s => {
      s.properties.owner = { type: 'string' };
      s.required.push('owner');
    });
    assert.equal(result.level, 'major');
  });

  it('treats a removed property as major', () => {
    assert.equal(change(s => delete s.properties.tier).level, 'major');
  });

  it('treats added enum values as minor and removed ones as major', () => {
    assert.equal(change(s => s.properties.tier.enum.push('tier-3')).level, 'minor');
    assert.equal(change(s => s.properties.tier.enum.pop()).level, 'major');
  });

  it('treats dropping a requirement as minor', () => {
    assert.equal(change(s => (s.required = [])).level, 'minor');
  });

  it('treats widening a type as minor and changing it as major', () => {
    assert.equal(change(s => (s.properties.name.type = ['string', 'null'])).level, 'minor');
    assert.equal(change(s => (s.properties.name.type = 'number')).level, 'major');
  });

  it('compares bounds by direction', () => {
    const withMax = structuredClone(base);
    withMax.properties.name.maxLength = 10;
    const longer = structuredClone(withMax);
    longer.properties.name.maxLength = 20;
    const shorter = structuredClone(withMax);
    shorter.properties.name.maxLength = 5;
    assert.equal(diffSchemas(withMax, longer).level, 'minor');
    assert.equal(diffSchemas(withMax, shorter).level, 'major');
  });

  it('treats a new pattern as major', () => {
    assert.equal(change(s => (s.properties.name.pattern = '^[a-z]+$')).level, 'major');
  });

  it('flags keywords it does not analyse for review, as at least minor', () => {
    const result = change(s => {
      s.allOf = [{ if: { properties: { tier: { const: 'tier-1' } } }, then: { required: ['name'] } }];
    });
    assert.equal(result.level, 'minor');
    assert.equal(result.changes[0].review, true);
  });

  it('reports the highest level across changes', () => {
    const result = change(s => {
      s.properties.name.description = 'x';
      s.properties.extra = { type: 'string' };
      delete s.properties.tier;
    });
    assert.equal(result.level, 'major');
    assert.equal(result.changes.length, 3);
  });
});
