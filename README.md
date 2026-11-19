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

1. In one PR, edit `component/OmdComponent.json`, bump `version` in
   `component/package.json`, and set the same `schema_version` in
   `component/sample/now.yaml`.
2. The **Release Check** comments on the PR with what will be released and
   fails if the change can't be released as it is.
3. Merge. `release.yaml` publishes `@test-org-th/omd-schema-component@<version>`
   to npm, then creates the tag `component-v<version>` and a GitHub release with
   the schema attached.

Service works the same way in `service/`. A PR can change both.

## What the release check enforces

`scripts/check-release.mjs`, per kind:

| What the package ships changed | Version changed | Result               |
| ------------------------------ | --------------- | -------------------- |
| no                             | no              | nothing to release   |
| yes                            | no              | fail: bump it        |
| no                             | yes             | fail: nothing to release |
| yes                            | yes             | checks below         |

"What the package ships" is the files in `files` plus `package.json` without
`version`, so a README change doesn't need a bump.

- The version is plain `X.Y.Z`, the next patch, minor or major after both
  `main` and the latest tag, and not tagged or published yet.
- The bump is at least what the schema change needs
  (`scripts/lib/schema-diff.mjs`):
  - major: a field becomes required, a property or enum value is removed, a
    type changes, a pattern or tighter bound is added
  - minor: a property or enum value is added, a requirement is dropped
  - patch: only `description`, `title`, `errorMessage`, `examples`, `default`
  - anything else (`if`/`then`, `allOf`, ...) needs at least minor and is
    flagged for review
- The schema compiles (AJV, `strict: false`, ajv-errors).
- The sample's `schema_version` matches the version.

```
npm ci
npm test                                                   # schema-diff unit tests
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
