@echo off
chcp 65001 >nul
echo ===========================================
echo   SmartSports 启动脚本（开发模式）
echo ===========================================
echo.

REM 启动Electron并自动打开开发者工具
start "SmartSports" /b "dist\win-unpacked\AI智能体育游戏.exe" --enable-logging --v=1 --auto-open-devtools-for-tabs

echo [INFO] 应用已启动，开发者工具将自动打开
echo [INFO] 按任意键结束...
pause