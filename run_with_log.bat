@echo off
chcp 65001 >nul
echo ===========================================
echo   SmartSports 启动脚本（带日志）
echo ===========================================
echo.

REM 启动Electron并重定向控制台输出到日志文件
start "SmartSports" /b "AI智能体育游戏.exe" --enable-logging --v=1 > "electron_log.txt" 2>&1

echo [INFO] 应用已启动
echo [INFO] 控制台日志将写入 electron_log.txt
echo [INFO] 按任意键打开日志文件...
pause

type electron_log.txt