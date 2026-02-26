@echo off
setlocal
title LOTIFI - Detener Servidor

set "PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
  set "PID=%%P"
  goto :kill
)

echo No se encontro ningun proceso escuchando en el puerto 3000.
pause
exit /b 0

:kill
echo Deteniendo proceso en puerto 3000 (PID %PID%)...
taskkill /PID %PID% /F >nul 2>&1

if errorlevel 1 (
  echo No se pudo detener el proceso. Intente ejecutar como administrador.
) else (
  echo Servidor detenido correctamente.
)

pause
