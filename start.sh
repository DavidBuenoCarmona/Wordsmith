#!/usr/bin/env bash
# =============================================================================
# Wordsmith — AI-Native 3D World Generator
# Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
# Licensed under the MIT License. See LICENSE for details.
# Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
# =============================================================================

echo "Starting Wordsmith Backend & Frontend..."
npm run dev:server &
SERVER_PID=$!
npm run dev:client &
CLIENT_PID=$!

echo "$SERVER_PID $CLIENT_PID" > .wordsmith.pid
echo "Wordsmith is running!"
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo "PIDs: Server ($SERVER_PID), Client ($CLIENT_PID) stored in .wordsmith.pid"
