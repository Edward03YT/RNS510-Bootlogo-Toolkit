@echo off
chcp 65001 >nul
title RNS 510 ISO Decompiler & Logo Visualizer

if "%~1"=="" goto launch_gui

echo =================================================================
echo   [EN] Opening ISO in RNS 510 Decompiler:
echo   [RO] Deshidere ISO in Decompilatorul RNS 510:
echo   %*
echo =================================================================
echo.

python "%~dp0rns510_iso_viewer.py" "%~1"
goto :eof

:launch_gui
echo =================================================================
echo   Starting ISO Visualizer / Pornire Vizualizator ISO...
echo =================================================================
python "%~dp0rns510_iso_viewer.py"
