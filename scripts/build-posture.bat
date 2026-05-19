@echo off
setlocal

cd /d "%~dp0.."

echo [INFO] Running npm.cmd run build:postrue...
call npm.cmd run build:postrue
if errorlevel 1 (
    echo [ERROR] build:postrue failed.
    exit /b %errorlevel%
)

echo [INFO] build:postrue completed.
