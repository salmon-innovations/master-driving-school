@echo off
echo Building Master Driving School APK...
echo.

set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk

call gradlew.bat assembleDebug --no-daemon

if errorlevel 1 (
    echo.
    echo BUILD FAILED! Check errors above.
    pause
    exit /b 1
)

echo.
echo ✓ Build successful!
echo APK: app\build\outputs\apk\debug\app-debug.apk
echo.
echo Run install_on_phone.bat to install on your device.
echo.
pause
