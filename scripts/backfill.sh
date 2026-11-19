#!/usr/bin/env bash
# Publishes every <kind>-vX.Y.Z tag that isn't on npm yet. The package is built
# from the files at the tag, with package.json from HEAD and the tag's version.
# Set DRY_RUN=true to only list what would be published.
set -euo pipefail

for kind in component service; do
  case $kind in
    component) schema=OmdComponent.json ;;
    service) schema=OmdService.json ;;
  esac
  name=$(jq -r .name "$kind/package.json")

  for tag in $(git tag -l "$kind-v*" --sort=v:refname); do
    version=${tag#"$kind-v"}
    if npm view "$name@$version" version >/dev/null 2>&1; then
      echo "skip     $name@$version (published)"
      continue
    fi

    if [ "${DRY_RUN:-false}" = "true" ]; then
      echo "would    $name@$version from $tag"
      continue
    fi

    out=$(mktemp -d)
    mkdir -p "$out/sample"
    git show "$tag:$kind/$schema" >"$out/$schema"
    git show "$tag:$kind/sample/now.yaml" >"$out/sample/now.yaml"
    jq --arg v "$version" '.version = $v' "$kind/package.json" >"$out/package.json"
    (cd "$out" && npm publish)
    echo "publish  $name@$version from $tag"
    rm -rf "$out"
  done
done
