#!/bin/sh
set -e

# Copy proof-generation binaries from image to mounted volume if they don't exist or differ
if [ ! -f "/workspace/packages/backend/proof-generation/zyga" ] || ! cmp -s "/opt/proof-generation/zyga" "/workspace/packages/backend/proof-generation/zyga" 2>/dev/null; then
    echo "Setting up proof-generation binaries..."
    mkdir -p /workspace/packages/backend/proof-generation
    cp -r /opt/proof-generation/* /workspace/packages/backend/proof-generation/
    chmod +x /workspace/packages/backend/proof-generation/zyga
fi

# Execute the command passed to the container
exec "$@"