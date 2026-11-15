// Validates a now.yaml against the schema version it declares, the way the
// CLI would use the bundle. Usage: node index.js <path/to/now.yaml>
const fs = require('node:fs');
const Ajv = require('ajv');
const ajvErrors = require('ajv-errors');
const yaml = require('js-yaml');
const index = require('@test-org-th/omd-schema/schemas/index.json');

const file = process.argv[2];
const doc = yaml.load(fs.readFileSync(file, 'utf8'));
const kind = doc.omd_component ? 'component' : 'service';
const fileName = kind === 'component' ? 'OmdComponent.json' : 'OmdService.json';
const version = doc.schema_version;

const known = index[kind].versions.map(v => v.version);
if (!known.includes(version)) {
  console.error(`${file}: no ${kind} schema ${version} (have ${known.join(', ')})`);
  process.exit(2);
}

const schema = require(`@test-org-th/omd-schema/schemas/${version}/${fileName}`);
const ajv = new Ajv({ allErrors: true, strict: false });
ajvErrors(ajv);
const validate = ajv.compile(schema);

if (validate(doc)) {
  console.log(`${file}: valid against ${kind} schema ${version}`);
} else {
  console.log(`${file}: ${validate.errors.length} errors against ${kind} schema ${version}`);
  for (const e of validate.errors) console.log(`  ${e.instancePath || '/'} ${e.message}`);
  process.exit(1);
}
