@echo off
chcp 65001 > nul

REM Stop running server on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Stopping server process PID: %%a
    taskkill /f /pid %%a > nul 2>&1
)

REM Check for Node.js
where npm > nul 2>&1
if %errorlevel% equ 0 (
    echo Starting server with Node.js...
    start "SmartSports Server" cmd /k "npm run dev"
) else (
    echo Node.js not found, starting with Python...
    start "SmartSports Server" cmd /k "python -m http.server 3001"
)

echo.
echo Server started! Please visit http://localhost:3001/
echo Press any key to exit this window...
pause > nul
