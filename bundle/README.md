# @test-org-th/omd-schema

Every released OMD schema version in one package. Sandbox for
[omd-schema](https://github.com/wbd-streaming/omd-schema).

```
schemas/
  index.json                 # versions per kind, newest first, with tag and commit
  v1.4.4/OmdComponent.json
  v1.2.1/OmdService.json
  ...
```

Pick the schema from the `schema_version` in a `now.yaml`:

```js
const index = require('@test-org-th/omd-schema/schemas/index.json');
const schema = require(`@test-org-th/omd-schema/schemas/${version}/OmdComponent.json`);
```

Each schema version is also a GitHub release (`component-v1.4.4`,
`service-v1.2.1`) with the JSON attached.
