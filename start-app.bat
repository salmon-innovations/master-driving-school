@echo off
title Booking System Launcher

echo ==========================================
echo   Booking System - Starting servers...
echo ==========================================
echo.

echo [1/2] Starting Backend (npm start)...
start "Booking System - Backend" cmd /k "cd /d "%~dp0booking-system-backend" && npm start"

echo [2/2] Starting Frontend (npm run dev)...
start "Booking System - Frontend" cmd /k "cd /d "%~dp0booking-system-frontend" && npm run dev"

echo.
echo Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

echo Opening browser at http://localhost:5173/
start "" "http://localhost:5173/"

echo.
echo ==========================================
echo   Both servers are running!
echo   Backend : http://localhost:3000
echo   Frontend: http://localhost:5173
echo ==========================================
echo.
echo You can close this window. The server
echo windows will keep running independently.
pause
