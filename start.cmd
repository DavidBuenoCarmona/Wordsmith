@echo off
REM =============================================================================
REM Wordsmith — AI-Native 3D World Generator
REM Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
REM Licensed under the MIT License. See LICENSE for details.
REM Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
REM =============================================================================

echo Starting Wordsmith Backend & Frontend...
start "Wordsmith Server" cmd /c "npm run dev:server"
start "Wordsmith Client" cmd /c "npm run dev:client"
echo Wordsmith is running!
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
