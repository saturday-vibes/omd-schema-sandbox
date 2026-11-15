#!/usr/bin/env bash
# One-time: creates a GitHub release for every imported tag, with that
# version's JSON attached and a compare link to the previous version.
# Run after the tags are pushed.
#
# Usage: scripts/create-import-releases.sh <owner/repo>
set -euo pipefail

repo=${1:?owner/repo}

for kind in service component; do
  case $kind in
    component) file=OmdComponent.json ;;
    service) file=OmdService.json ;;
  esac

  prev=
  tmp=$(mktemp -d)
  for tag in $(git tag -l "$kind-v*" --sort=v:refname); do
    git show "$tag:$kind/$file" >"$tmp/$file"
    notes="Imported from action-validate-now-dot-yaml."
    if [ -n "$prev" ]; then
      notes="$notes

Changes: https://github.com/$repo/compare/$prev...$tag"
    fi
    gh release create "$tag" "$tmp/$file" --repo "$repo" --verify-tag \
      --title "$tag" --notes "$notes" --latest=false
    prev=$tag
  done
  rm -rf "$tmp"
done
