@echo off
REM =============================================================================
REM Wordsmith — AI-Native 3D World Generator
REM Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
REM Licensed under the MIT License. See LICENSE for details.
REM Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
REM =============================================================================

echo Stopping Wordsmith processes...
taskkill /F /FI "WINDOWTITLE eq Wordsmith Server*" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq Wordsmith Client*" /T 2>nul
echo Wordsmith stopped.
