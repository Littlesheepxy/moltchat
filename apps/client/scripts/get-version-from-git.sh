#!/usr/bin/env bash

# Echoes a version based on the git hashes of the element-web & js-sdk checkouts, for the case where
# these dependencies are git checkouts.

set -e

# Handle case where .git directory doesn't exist (Docker build without git)
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "1.0.0"
    exit 0
fi

# Since the deps are fetched from git & linked, we can rev-parse
JSSDK_SHA=$(git -C node_modules/matrix-js-sdk rev-parse --short=12 HEAD 2>/dev/null || echo "unknown")
VECTOR_SHA=$(git rev-parse --short=12 HEAD 2>/dev/null || echo "unknown") # use the ACTUAL SHA rather than assume develop
echo "$VECTOR_SHA-js-$JSSDK_SHA"
