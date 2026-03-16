#!/usr/bin/env bash

VERSION="v0.6.0"
BASE_REPO=""

docker build --build-arg NEXT_PUBLIC_BASE_PATH=/vexa -t "${BASE_REPO}/vexa/vexa-dashboard:${VERSION}" --build-arg NEXT_PUBLIC_BASE_PATH=/vexa .
docker push "${BASE_REPO}/vexa/vexa-dashboard:${VERSION}"
