# @test-org-th/omd-schema-component

JSON schema (draft-07) for OMD component `now.yaml` files. The package version
is the schema version.

- `OmdComponent.json`: the schema (`main`). It uses ajv-errors keywords, so
  compile it with AJV `strict: false` and the ajv-errors plugin.
- `sample/now.yaml`: a template for a component `now.yaml`.

To use several versions side by side, install them with aliases:

```json
"omd-schema-component-v1.4.5": "npm:@test-org-th/omd-schema-component@1.4.5"
```

Release notes: [GitHub releases](https://github.com/saturday-vibes/omd-schema-sandbox/releases)
(tags `component-vX.Y.Z`).
