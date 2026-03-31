@echo off
echo ================================================
echo   Master Driving School - Android App Installer
echo ================================================
echo.

set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
set APK=app\build\outputs\apk\debug\app-debug.apk

echo Checking for connected Android devices...
"%ADB%" devices -l
echo.

"%ADB%" devices | findstr /V "List of devices" | findstr "device" >nul 2>&1
if errorlevel 1 (
    echo ERROR: No Android device detected!
    echo.
    echo Please:
    echo  1. Connect your phone via USB cable
    echo  2. Enable USB Debugging on your phone:
    echo     Settings ^> About Phone ^> Tap "Build Number" 7 times
    echo     Then go to Developer Options ^> Enable USB Debugging
    echo  3. Accept the "Allow USB Debugging" popup on your phone
    echo  4. Run this script again
    echo.
    pause
    exit /b 1
)

echo Device found! Installing APK...
echo.

"%ADB%" install -r "%APK%"

if errorlevel 0 (
    echo.
    echo ✓ SUCCESS! Master Driving School app installed on your phone!
    echo   Look for "Master Driving School" in your app drawer.
    echo.
) else (
    echo.
    echo Installation failed. Check the error message above.
    echo.
)

pause
