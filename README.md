# omd-schema-sandbox

Trying out one schema file per kind, versioned with tags, for
[omd-schema](https://github.com/wbd-streaming/omd-schema).

```
component/OmdComponent.json   latest component schema
component/sample/now.yaml
service/OmdService.json       latest service schema
service/sample/now.yaml
```

## How a schema change is released

1. Open a PR that edits `component/OmdComponent.json` (and its sample). Use a
   conventional title: `feat: ...` is a minor bump, `fix: ...` a patch. Add
   `Release-As: 1.4.5` to the commit body to pick the version yourself.
1. After merge, release-please opens or updates one `chore: release main` PR.
   It bumps the schema (`component/version.txt`) and the npm package
   (`bundle/package.json`) together, with a changelog for each.
1. Merging that PR creates two releases:
   - `component-vx.y.z` with only `OmdComponent.json` attached. The changelog
     links to the diff against the previous version.
   - `bundle-va.b.c`, which builds `@test-org-th/omd-schema` from every schema
     tag, publishes it to npm and attaches the `.tgz`.

Service works the same way with `service/` and `service-vx.y.z` tags. A change
that only touches `bundle/` releases just the npm package.

The npm version lives in `bundle/package.json` and
`.release-please-manifest.json`. Nothing reads it back from the registry.

## Diffs between versions

```sh
git diff component-v1.4.3 component-v1.4.4 -- component/OmdComponent.json
```

or on GitHub: `compare/component-v1.4.3...component-v1.4.4`.

## Using every version (CLI)

`main` only has the latest schema. The npm package has all of them, built by
`scripts/build-bundle.sh` from the tags:

```
schemas/index.json                versions per kind with tag and commit
schemas/v1.4.4/OmdComponent.json
schemas/v1.2.1/OmdService.json
```

See `examples/cli-consumer` for loading the schema a `now.yaml` asks for.
