#!/bin/sh
echo "Starting credentials automation backend service..."
exec pnpm --filter @itr/service start
