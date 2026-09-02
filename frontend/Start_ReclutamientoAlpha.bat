@echo off
title ReclutamientoAlpha - Inicio Rápido

echo.
echo ========================================
echo   RECLUTAMIENTO ALPHA - SISTEMA DE RRHH
echo ========================================
echo.

echo [1/3] Iniciando servidor backend...
cd /d "C:\ReclutaminetoAlpha-Entrega\backend"
start "Backend Alpha" cmd /k "node server.js"

echo [2/3] Esperando 5 segundos...
timeout /t 5 /nobreak > nul

echo [3/3] Abriendo frontend...
start http://localhost:3001

echo.
echo ========================================
echo   SISTEMA INICIADO CORRECTAMENTE
echo ========================================
echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3001/index.html
echo.
echo Cierra esta ventana cuando quieras detener el sistema.
echo Para detener el backend, cierra la ventana negra.
echo.
pause