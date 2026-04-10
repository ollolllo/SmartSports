const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// 获取应用根目录（处理打包后路径）
const appRoot = app.isPackaged 
    ? path.dirname(app.getPath('exe')) 
    : __dirname;
process.chdir(appRoot);

// 忽略证书错误（用于自签名证书）
app.commandLine.appendSwitch('ignore-certificate-errors');

// 启用硬件加速
app.commandLine.appendSwitch('enable-gpu-rasterization');

// 允许所有媒体设备访问
app.commandLine.appendSwitch('allow-file-access-from-files');

// 禁用沙箱以获得更多权限
app.commandLine.appendSwitch('no-sandbox');

// 允许不安全的混合内容
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');

// 允许WebGL
app.commandLine.appendSwitch('enable-webgl');

// 禁用WebRTC硬件加速（可能解决某些摄像头问题）
app.commandLine.appendSwitch('disable-webrtc-hw-encoding');
app.commandLine.appendSwitch('disable-webrtc-hw-decoding');

// 允许跨域请求
app.commandLine.appendSwitch('disable-web-security');

// 允许加载本地文件
app.commandLine.appendSwitch('allow-insecure-localhost');
app.commandLine.appendSwitch('allow-running-insecure-content');

// 允许file协议访问
app.commandLine.appendSwitch('enable-local-file-urls');

const HTTP_SERVER = 'https://192.168.13.135';

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            allowRunningInsecureContent: true,
            sandbox: false,
            experimentalFeatures: true,
            plugins: true
        }
    });

    // 立即打开开发者工具
    win.webContents.openDevTools();

    // 拦截mediapipe文件请求并重定向到HTTP服务器
    win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        const url = details.url;
        let redirectUrl = null;

        // 拦截mediapipe和common目录的请求
        if (url.includes('/mediapipe/') || url.includes('/common/')) {
            const match = url.match(/\/(mediapipe\/.*|common\/.*)$/);
            if (match) {
                redirectUrl = HTTP_SERVER + '/' + match[1];
            }
        }

        // 拦截TensorFlow.js模块请求
        if (url.includes('@tensorflow/tfjs') || url.includes('cdn.jsdelivr.net/npm/@tensorflow')) {
            redirectUrl = url.replace('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs', 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0');
        }

        if (redirectUrl) {
            console.log('Redirecting:', url, '->', redirectUrl);
            callback({ redirectURL: redirectUrl });
        } else {
            callback({});
        }
    });

    // 预先设置权限
    const session = win.webContents.session;
    
    // 设置权限请求处理器
    session.setPermissionRequestHandler((webContents, permission, callback) => {
        console.log('Permission requested:', permission);
        if (permission === 'media' || permission === 'camera' || permission === 'microphone' || permission === 'video-capture') {
            callback(true);
        } else {
            callback(false);
        }
    });

    // 设置设备权限处理器
    session.setDevicePermissionHandler((details) => {
        console.log('Device permission requested:', details);
        return true;
    });

    // 监听权限被授予的事件
    win.webContents.on('permission-granted', (permission) => {
        console.log('Permission granted:', permission);
    });

    // 监听权限被拒绝的事件
    win.webContents.on('permission-denied', (permission) => {
        console.log('Permission denied:', permission);
    });

    // 立即打开开发者工具
    win.webContents.openDevTools({mode: 'detach'});

    // 从网络加载文件
    win.loadURL(HTTP_SERVER + '/');

    // 页面显示后再次确保开发者工具打开
    win.once('ready-to-show', () => {
        console.log('Window ready to show');
    });

    // 监听控制台消息
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log('Console [' + level + ']: ' + message);
    });

    // 监听页面错误
    win.webContents.on('render-process-gone', (event, details) => {
        console.log('Render process gone:', details);
    });

    // 监听页面加载错误
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.log('Failed to load:', errorCode, errorDescription);
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});