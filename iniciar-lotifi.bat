@echo off
setlocal
title LOTIFI - Iniciar Servidor

cd /d "%~dp0backend"

if not exist "server.js" (
  echo [ERROR] No se encontro backend\server.js
  echo Cierre esta ventana y revise la ubicacion del archivo .bat
  pause
  exit /b 1
)

echo Iniciando LOTIFI en http://localhost:3000 ...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

node server.js

echo.
echo El servidor se detuvo.
pause
