@echo off
chcp 65001 >nul
title VW RNS 510 Bootlogo Web Studio
echo =======================================================================
echo   🚗 VW RNS 510 / Columbus / Seat Media - Web Studio Launcher
echo =======================================================================
echo.
cd /d "%~dp0web"

if not exist "node_modules" (
    echo [INFO] Se instalează dependențele inițiale npm...
    call npm install
)

echo [✓] Se pornește serverul Next.js pe http://localhost:3000 ...
echo [✓] Deschidere automată în browser...
start http://localhost:3000

call npm run dev
pause
