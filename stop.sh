#!/usr/bin/env bash
# =============================================================================
# Wordsmith — AI-Native 3D World Generator
# Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
# Licensed under the MIT License. See LICENSE for details.
# Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
# =============================================================================

echo "Stopping Wordsmith processes..."
if [ -f .wordsmith.pid ]; then
  kill $(cat .wordsmith.pid) 2>/dev/null
  rm -f .wordsmith.pid
  echo "Wordsmith stopped."
else
  pkill -f "npm run dev:server" 2>/dev/null
  pkill -f "npm run dev:client" 2>/dev/null
  echo "Wordsmith processes stopped."
fi
