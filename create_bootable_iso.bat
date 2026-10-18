@echo off
chcp 65001 >nul
title RNS 510 Bootlogo Creator & ISO Builder

if "%~1"=="" goto gui_mode

echo =================================================================
echo   [EN] Generating RNS 510 Bootable ISO for:
echo   [RO] Generare ISO Bootabil RNS 510 pentru:
echo   %*
echo =================================================================
echo.

python "%~dp0rns510_bootlogo.py" %*

echo.
pause
goto :eof

:gui_mode
echo =================================================================
echo   Starting GUI Mode / Pornire Interfata Grafica...
echo =================================================================
python "%~dp0rns510_bootlogo.py" --gui
