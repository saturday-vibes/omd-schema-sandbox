# @test-org-th/omd-schema-service

JSON schema (draft-07) for OMD service `now.yaml` files. The package version
is the schema version.

- `OmdService.json`: the schema (`main`). It uses ajv-errors keywords, so
  compile it with AJV `strict: false` and the ajv-errors plugin.
- `sample/now.yaml`: a template for a service `now.yaml`.

To use several versions side by side, install them with aliases:

```json
"omd-schema-service-v1.3.0": "npm:@test-org-th/omd-schema-service@1.3.0"
```

Release notes: [GitHub releases](https://github.com/saturday-vibes/omd-schema-sandbox/releases)
(tags `service-vX.Y.Z`).
