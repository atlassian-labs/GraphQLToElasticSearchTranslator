#!/bin/bash

function print_usage {
    echo "Usage: bin/upload-js.sh <directory>"
}

if [ $# -ne 1 ]; then
    print_usage
    exit 1
fi

set -e
cd $1

npm install --unsafe-perm
npm publish --unsafe-perm --registry https://packages.atlassian.com/artifactory/api/npm/npm-private-local/