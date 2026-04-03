@echo off

REM 停止运行中的Node.js服务器
netstat -ano | findstr :3000 > nul
if %errorlevel% equ 0 (
    echo 正在停止Node.js服务器...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /f /pid %%a
    echo 服务器已停止
) else (
    echo 没有运行中的Node.js服务器
)

REM 启动Node.js服务器
echo 正在启动Node.js服务器...
start "SmartSports Server" cmd /c "npm run dev"
echo 服务器已启动

echo 重启完成！请访问 http://localhost:3000/