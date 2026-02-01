#!/bin/sh
# Ensure proof-generation is available (from image if volume is empty)
if [ ! -f /workspace/packages/backend/proof-generation/zyga ]; then
  mkdir -p /workspace/packages/backend/proof-generation
  cp -r /opt/proof-generation/. /workspace/packages/backend/proof-generation/
  chmod +x /workspace/packages/backend/proof-generation/zyga
fi
exec "$@"
