#!/usr/bin/env bash

set -ex

DIR=$(dirname "$0")

# Handle case where .git directory doesn't exist (Docker build without git)
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    
    # If the branch comes out as HEAD then we're probably checked out to a tag, so if the thing is *not*
    # coming out as HEAD then we're on a branch. When we're on a branch, we want to resolve ourselves to
    # a few SHAs rather than a version.
    if [[ $BRANCH != HEAD && ! $BRANCH =~ heads/v.+ ]]
    then
        DIST_VERSION=$("$DIR"/get-version-from-git.sh)
    else
        DIST_VERSION=$(git describe --abbrev=0 --tags 2>/dev/null || echo "1.0.0")
    fi
    
    DIST_VERSION=$("$DIR"/normalize-version.sh "$DIST_VERSION")
else
    # No git, use a default version
    DIST_VERSION="1.0.0"
fi

VERSION=$DIST_VERSION yarn build
