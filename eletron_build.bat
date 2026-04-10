@echo off
chcp 65001 >nul
echo ===========================================
echo   SmartSports Electron 打包脚本
echo ===========================================
echo.

REM 检查是否存在dist目录，如果存在则清空
if exist "dist" (
    echo [INFO] 清空旧的dist目录...
    rmdir /s /q "dist"
)

REM 执行electron-builder打包
echo [INFO] 开始打包...
call npm run electron:build

echo.
echo [INFO] 打包完成！
echo [INFO] 打包文件位于 dist 目录
echo.

pause