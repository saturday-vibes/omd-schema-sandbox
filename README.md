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
1. After merge, release-please opens `chore: release component x.y.z`.
1. Merging that PR tags `component-vx.y.z` and creates a GitHub release with
   only `OmdComponent.json` attached. The changelog links to the diff against
   the previous version.
1. The same run rebuilds the npm package `saturday-vibes-omd-schema` from all
   tags and publishes it with the next minor version.

Service works the same way with `service/` and `service-vx.y.z` tags.

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
