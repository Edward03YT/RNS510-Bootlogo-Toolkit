@echo off
chcp 65001 >nul
title RNS 510 Bootlogo Quality & Artifact Diagnostic

if "%~1"=="" goto no_args

echo =================================================================
echo   [EN] Quality Scan & Artifact / Green Speck Detection:
echo   [RO] Scanare Calitate si Cautare Artefacte / Purici Verzi:
echo   %*
echo =================================================================
echo.

python "%~dp0rns510_bootlogo.py" "%~1" --verify

echo.
pause
goto :eof

:no_args
echo =================================================================
echo   [EN] Drag and drop an Image, .FLI, or .ISO file over this batch file!
echo   [RO] Trageți (Drag and Drop) o imagine, un .FLI sau un .ISO peste acest fișier!
echo =================================================================
echo.
pause
