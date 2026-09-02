@echo on
setlocal ENABLEDELAYEDEXPANSION

rem === Mostrar siempre una ventana visible para diagnosticar ===
title ReclutamientoAlpha - Arranque
cd /d "%~dp0"

set "BACKEND_DIR=backend"
set "HEALTH_URL=http://localhost:3001/api/health"
set "FRONTEND_URL=http://localhost:3001/index.html"

set "LOGDIR=%LOCALAPPDATA%\ReclutamientoAlpha"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set "LOG=%LOGDIR%\start.log"

echo ==== INICIO %DATE% %TIME% ==== >>"%LOG%"
echo [INFO] Script dir: %cd% >>"%LOG%"

where node >>"%LOG%" 2>>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta en PATH >>"%LOG%"
  echo ERROR: Node.js no esta instalado o no esta en PATH. Instala Node LTS y prueba "node -v".
  pause
  exit /b 1
)

if not exist "%BACKEND_DIR%\server.js" (
  echo [ERROR] No existe backend\server.js >>"%LOG%"
  echo ERROR: No se encontro "%BACKEND_DIR%\server.js". Revisa la ruta del proyecto.
  pause
  exit /b 1
)

cd "%BACKEND_DIR%"
if not exist node_modules (
  echo [INFO] Instalando dependencias... >>"%LOG%"
  call npm ci >>"%LOG%" 2>>&1 || call npm install >>"%LOG%" 2>>&1
)

echo [INFO] Arrancando backend con npm start... >>"%LOG%"
start "" /min cmd /c "npm start"

echo [INFO] Esperando health... >>"%LOG%"
powershell -NoLogo -NoProfile -Command ^
  "$u='%HEALTH_URL%'; for($i=0;$i -lt 50;$i++){try{ $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ exit 0 }}catch{} Start-Sleep -Milliseconds 300 }; exit 1"

if errorlevel 1 (
  echo [WARN] Health no respondio (abrire igual) >>"%LOG%"
)

start "" "%FRONTEND_URL%"
echo [INFO] Navegador abierto: %FRONTEND_URL% >>"%LOG%"

echo ==== FIN %DATE% %TIME% ==== >>"%LOG%"
echo.
echo Listo. Si algo fallo, abre este log:
echo %LOG%
pause
exit /b 0
