@echo off
chcp 65001 >nul
title VW RNS 510 - Comparator ISO & Verificator Semnătură SWL
color 0B

echo ===============================================================================
echo       VW RNS 510 TOOLKIT - SISTEM DE COMPARARE & DIAGNOZĂ IMAGINI ISO
echo ===============================================================================
echo.

set ISO_REF=%~1
set ISO_TGT=%~2

if "%ISO_REF%"=="" (
    echo Trage discul ISO de referință (care funcționează) în această fereastră și apasă Enter:
    set /p ISO_REF="[Disc A Referință]: "
)

if "%ISO_TGT%"=="" (
    echo Trage discul ISO creat de tine (care vrei să îl verifici) și apasă Enter:
    set /p ISO_TGT="[Disc B De Verificat]: "
)

:: Curățare ghilimele dacă au fost introduse
set ISO_REF=%ISO_REF:"=%
set ISO_TGT=%ISO_TGT:"=%

echo.
echo Se analizează semnăturile SWL, VERSION.TXT, ECUORDER.TXT și LOGO.FLI...
echo.

python compare_iso.py "%ISO_REF%" "%ISO_TGT%"

echo.
echo ===============================================================================
echo Poți folosi și interfața grafică web din browser la:
echo http://localhost:3000 (Tabul "⚖️ Comparație ISO & Semnături")
echo ===============================================================================
echo.
pause
