@echo off
chcp 65001 >nul
title RNS 510 Map Source Verifier

if "%~1"=="" goto launch_gui

echo =================================================================
echo   [EN] Opening in RNS 510 Map Source Verifier:
echo   [RO] Deschidere in Verificator Surse Harti RNS 510:
echo   %*
echo =================================================================
echo.

python -m mapverify.gui "%~1"
goto :eof

:launch_gui
echo =================================================================
echo   [EN] Starting RNS 510 Map Source Verifier GUI...
echo   [RO] Pornire Interfata Grafica Verificator Harti RNS 510...
echo =================================================================
python -m mapverify.gui
