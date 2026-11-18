#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/../.." && pwd)
component=${1:?Usage: build.sh native|backend|gateway|ui}
tag=${IMAGE_TAG:?Set IMAGE_TAG to a release version}
registry=${IMAGE_PREFIX:-ai-gw}
case "$component" in
  native)
    docker build --file "$repo/docker/Dockerfile.native" --target artifact --tag "$registry/native:$tag" "$repo"
    ;;
  backend|gateway)
    native=${NATIVE_IMAGE:?Set NATIVE_IMAGE to a compatible prebuilt native artifact image}
    docker build --file "$repo/$component/Dockerfile" --build-arg "NATIVE_IMAGE=$native" --tag "$registry/$component:$tag" "$repo"
    ;;
  ui)
    docker build --file "$repo/ui/Dockerfile" --tag "$registry/ui:$tag" "$repo"
    ;;
  *) echo 'Unknown component' >&2; exit 2 ;;
esac
