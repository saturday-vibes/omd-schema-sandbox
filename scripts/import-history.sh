#!/usr/bin/env bash
# One-time import of the versioned folders from action-validate-now-dot-yaml.
# Replays every version, oldest first, into component/OmdComponent.json and
# service/OmdService.json: one commit and one tag per schema version, so
# `git diff component-v1.4.3 component-v1.4.4` shows the real change.
#
# Usage: scripts/import-history.sh <path-to-action-validate-now-dot-yaml>
set -euo pipefail

src=${1:?path to action-validate-now-dot-yaml}

for v in $(ls "$src/schemas" | sort -V); do
  for kind in service component; do
    case $kind in
      component)
        file=OmdComponent.json
        sample=$(ls -d "$src/schema_samples/$v"/omd*component_name 2>/dev/null)/now.yaml
        ;;
      service)
        file=OmdService.json
        sample=$src/schema_samples/$v/now.yaml
        ;;
    esac
    [ -f "$src/schemas/$v/$file" ] || continue

    cp "$src/schemas/$v/$file" "$kind/$file"
    cp "$sample" "$kind/sample/now.yaml"
    echo "${v#v}" >"$kind/version.txt"

    {
      echo "# Changelog"
      echo
      echo "## ${v#v}"
      echo
      echo "Imported from action-validate-now-dot-yaml (schemas/$v/$file)."
      echo
      [ -f "$kind/CHANGELOG.md" ] && tail -n +3 "$kind/CHANGELOG.md"
    } >"$kind/CHANGELOG.tmp"
    mv "$kind/CHANGELOG.tmp" "$kind/CHANGELOG.md"

    git add "$kind"
    git commit -qm "feat: import $kind schema $v"
    git tag "$kind-$v"
    echo "$kind-$v"
  done
done

jq -n \
  --arg c "$(cat component/version.txt)" \
  --arg s "$(cat service/version.txt)" \
  '{component: $c, service: $s}' >.release-please-manifest.json
git add .release-please-manifest.json
git commit -qm "chore: start release-please at the imported versions"
