@echo off
setlocal
cd /d "%~dp0booking-system-backend"

echo ==============================================
echo    MASTER DRIVING SCHOOL MAINTENANCE TOOL
echo ==============================================
echo.

if exist ".maintenance" (
    echo [STATUS] System is currently in MAINTENANCE MODE.
    echo.
    set /p choice="Do you want to turn OFF Maintenance Mode? (Y/N): "
    if /i "%choice%"=="Y" (
        del .maintenance
        echo.
        echo [SUCCESS] Maintenance Mode is now OFF. The website is live.
    ) else (
        echo.
        echo Operation cancelled. System remains in maintenance mode.
    )
) else (
    echo [STATUS] System is currently LIVE (Maintenance Mode is OFF).
    echo.
    set /p choice="Do you want to turn ON Maintenance Mode? (Y/N): "
    if /i "%choice%"=="Y" (
        echo Maintenance > .maintenance
        echo.
        echo [SUCCESS] Maintenance Mode is now ON. Only admins can access the website.
    ) else (
        echo.
        echo Operation cancelled. System remains live.
    )
)

echo.
pause
