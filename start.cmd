@echo off
REM =============================================================================
REM Wordsmith — AI-Native 3D World Generator
REM Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
REM Licensed under the MIT License. See LICENSE for details.
REM Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
REM =============================================================================
REM Auto-reparable: instala dependencias, compila el paquete shared y crea .env
REM si faltan. Las ventanas se quedan abiertas (cmd /k) para ver cualquier error.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado. Instalalo desde https://nodejs.org y vuelve a ejecutar.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [FIX] Falta node_modules. Instalando dependencias...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist packages\shared\dist\index.js (
  echo [FIX] Falta compilar @wordsmith/shared. Compilando...
  call npm run build --workspace=@wordsmith/shared
  if errorlevel 1 goto :fail
)

if not exist .env (
  if exist .env.example (
    echo [FIX] Falta .env. Copiando desde .env.example...
    copy .env.example .env >nul
  ) else (
    echo [AVISO] No existe .env ni .env.example. El servidor puede usar proveedores mock.
  )
)

echo Starting Wordsmith Backend ^& Frontend...
start "Wordsmith Server" cmd /k "npm run dev:server"
start "Wordsmith Client" cmd /k "npm run dev:client"
echo Wordsmith is running!
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
exit /b 0

:fail
echo.
echo [ERROR] Fallo la preparacion automatica. Revisa los mensajes anteriores.
pause
exit /b 1
