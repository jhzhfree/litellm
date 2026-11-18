#!/usr/bin/env bash
set -euo pipefail
release_dir=$(cd "$(dirname "$0")/.." && pwd)
repo=${1:-/workspace/litellm}
component=${2:?Usage: build.sh REPO native|gateway|ui}
export IMAGE_TAG=${IMAGE_TAG:?Set the component release tag}
export IMAGE_PREFIX=${IMAGE_PREFIX:-ai-gw}
case "$component" in native|gateway|ui) ;; *) echo 'Unsupported release component' >&2; exit 2;; esac
mkdir -p "$release_dir/images" "$release_dir/logs"
bash "$repo/docker/split/build.sh" "$component" 2>&1 | tee "$release_dir/logs/build-$component-$IMAGE_TAG.log"
archive="$release_dir/images/$component-$IMAGE_TAG.tar"
docker save --output "$archive" "$IMAGE_PREFIX/$component:$IMAGE_TAG"
sha256sum "$archive" > "$archive.sha256"
printf 'Exported %s\n' "$archive"
