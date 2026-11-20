# omd-schema-sandbox

Sandbox for [omd-schema](https://github.com/wbd-streaming/omd-schema): one npm
package per schema kind, one npm version per schema version.

```
component/
  package.json          @test-org-th/omd-schema-component, version = schema version
  OmdComponent.json
  sample/now.yaml       schema_version must match the version
service/
  package.json          @test-org-th/omd-schema-service
  OmdService.json
  sample/now.yaml
```

Consumers that need several versions side by side install them with aliases:

```json
"omd-schema-component-v1.4.5": "npm:@test-org-th/omd-schema-component@1.4.5"
```

## Releasing a schema change

1. In one PR, edit `component/OmdComponent.json` and bump `version` in
   `component/package.json`.
2. The **Release Check** comments on the PR with what will be released.
3. Merge. `release.yaml` publishes `@test-org-th/omd-schema-component@<version>`
   to npm, then creates the tag `component-v<version>` and a GitHub release with
   the schema attached.

Service works the same way in `service/`. A PR can change both.

## What the release check enforces

`scripts/check-release.mjs`, per kind, when a file the package ships (its
`files` or `package.json`) changed:

- the version is plain `X.Y.Z` and higher than both `main` and the latest tag
- the schema compiles (AJV, `strict: false`, ajv-errors)

A README change doesn't need a bump.

```
npm ci
node scripts/check-release.mjs check --base origin/main    # what this branch releases
```

## Diffs between versions

```
git diff component-v1.4.4 component-v1.4.5 -- component/OmdComponent.json
```

## Backfill

`backfill.yaml` (manual, dry run by default) publishes every existing tag that
isn't on npm yet, from the files at that tag.

## Notifying consumers

If the `CLI_DISPATCH_TOKEN` secret is set, `release.yaml` sends a
`schema-published` event to
[omd-cli-poc](https://github.com/saturday-vibes/omd-cli-poc), which opens a PR
adding the new versions. Without it, omd-cli-poc checks npm on a schedule.
