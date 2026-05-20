const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

protocol.registerSchemesAsPrivileged([
    { scheme: 'mediapipe', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

const REMOTE_SERVER = 'https://192.168.103.102';
const ALLOW_DEVTOOLS_FROM_ARGS = true;
const ENABLE_DEVTOOLS = ALLOW_DEVTOOLS_FROM_ARGS && process.argv.includes('--devtools');

app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', REMOTE_SERVER);

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (url.startsWith(REMOTE_SERVER)) {
        event.preventDefault();
        callback(true);
        return;
    }
    callback(false);
});

function getActiveMediapipeRoot() {
    const appPath = app.getAppPath();
    const asarMediapipePath = path.join(appPath, 'mediapipe');
    if (fs.existsSync(asarMediapipePath)) {
        return asarMediapipePath;
    }
    const devPath = path.join(__dirname, 'mediapipe');
    if (fs.existsSync(devPath)) {
        return devPath;
    }
    const userDataPath = path.join(app.getPath('userData'), 'mediapipe');
    if (fs.existsSync(userDataPath)) {
        return userDataPath;
    }
    console.warn('[mediapipe] No mediapipe path found, falling back to app path:', appPath);
    return path.join(appPath, 'mediapipe');
}

function fileExists(filePath) {
    try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.wasm': 'application/wasm',
        '.tflite': 'application/octet-stream',
        '.binarypb': 'application/octet-stream',
        '.data': 'application/octet-stream',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

function setupMediapipeProtocol() {
    protocol.handle('mediapipe', async (request) => {
        const url = new URL(request.url);
        const relativePath = decodeURIComponent(url.pathname).replace(/^\/local\//, '');
        const mediapipeRoot = getActiveMediapipeRoot();
        let localPath = path.join(mediapipeRoot, relativePath);
        
        if (relativePath.startsWith('pose/') && !fileExists(localPath)) {
            const fallbackPath = path.join(mediapipeRoot, path.basename(relativePath));
            if (fileExists(fallbackPath)) {
                localPath = fallbackPath;
            }
        }
        
        if (!fileExists(localPath)) {
            return new Response('File not found', { status: 404 });
        }
        
        try {
            const fileContent = await fsp.readFile(localPath);
            const mimeType = getMimeType(localPath);
            return new Response(fileContent, {
                status: 200,
                headers: {
                    'Content-Type': mimeType,
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (error) {
            console.error('[mediapipe] Failed to serve file:', localPath, error);
            return new Response('Internal server error', { status: 500 });
        }
    });
    console.log('[mediapipe] Protocol registered');
}

function redirectMediapipeToLocal(session) {
    session.webRequest.onBeforeRequest(
        { urls: [`${REMOTE_SERVER}/mediapipe/*`] },
        (details, callback) => {
            const requestUrl = new URL(details.url);
            let relativePath = requestUrl.pathname.replace(/^\/mediapipe\//, '');
            const mediapipeUrl = `mediapipe://local/${relativePath}`;
            console.log('[mediapipe] Redirect:', details.url, '->', mediapipeUrl);
            callback({ redirectURL: mediapipeUrl });
        }
    );
}

function allowCameraPermissions(session) {
    session.setPermissionRequestHandler((webContents, permission, callback) => {
        callback([
            'media',
            'camera',
            'microphone',
            'video-capture',
            'audio-capture'
        ].includes(permission));
    });

    session.setPermissionCheckHandler(() => true);

    session.setDevicePermissionHandler(() => true);
}

async function stopPageMediaStreams(webContents) {
    if (webContents.isDestroyed()) return;

    try {
        await webContents.executeJavaScript(`
            (() => {
                document.querySelectorAll('video').forEach(video => {
                    const stream = video.srcObject;
                    if (stream && typeof stream.getTracks === 'function') {
                        stream.getTracks().forEach(track => track.stop());
                    }
                    video.srcObject = null;
                });
            })();
        `, true);
        await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
        console.warn('Failed to stop page media streams:', error.message);
    }
}

function injectMediaCleanup(webContents) {
    if (webContents.isDestroyed()) return;

    webContents.executeJavaScript(`
        (() => {
            if (window.__SMART_SPORTS_MEDIA_CLEANUP_INSTALLED__) return;
            window.__SMART_SPORTS_MEDIA_CLEANUP_INSTALLED__ = true;

            window.addEventListener('beforeunload', () => {
                document.querySelectorAll('video').forEach(video => {
                    const stream = video.srcObject;
                    if (stream && typeof stream.getTracks === 'function') {
                        stream.getTracks().forEach(track => track.stop());
                    }
                    video.srcObject = null;
                });
            });
        })();
    `, true).catch(error => {
        console.warn('Failed to inject media cleanup:', error.message);
    });
}

function injectRendererDiagnostics(webContents) {
    if (webContents.isDestroyed()) return;

    webContents.executeJavaScript(`
        (() => {
            if (window.__SMART_SPORTS_DIAGNOSTICS_INSTALLED__) return;
            window.__SMART_SPORTS_DIAGNOSTICS_INSTALLED__ = true;

            window.addEventListener('error', event => {
                console.error('[window.error]', event.message, event.filename + ':' + event.lineno + ':' + event.colno);
                if (event.error && event.error.stack) {
                    console.error('[window.error.stack]', event.error.stack);
                }
            });

            window.addEventListener('unhandledrejection', event => {
                const reason = event.reason;
                console.error('[unhandledrejection]', reason && reason.stack ? reason.stack : reason);
            });

            document.addEventListener('securitypolicyviolation', event => {
                console.error('[csp]', event.blockedURI, event.violatedDirective);
            });
        })();
    `, true).catch(error => {
        console.warn('Failed to inject renderer diagnostics:', error.message);
    });
}

function createWindow() {
    let navigationStartedByShell = false;
    let pendingNavigationUrl = null;

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            allowDisplayingInsecureContent: true
        }
    });

    allowCameraPermissions(win.webContents.session);
    redirectMediapipeToLocal(win.webContents.session);

    win.webContents.on('before-input-event', (event, input) => {
        const key = input.key.toLowerCase();
        const isDevToolsShortcut =
            key === 'f12' ||
            (input.control && input.shift && key === 'i') ||
            (input.control && input.shift && key === 'j') ||
            (input.control && key === 'u');

        if (!ENABLE_DEVTOOLS && isDevToolsShortcut) {
            event.preventDefault();
        }
    });

    win.webContents.on('context-menu', (event) => {
        if (!ENABLE_DEVTOOLS) {
            event.preventDefault();
        }
    });

    if (ENABLE_DEVTOOLS) {
        win.webContents.openDevTools({ mode: 'detach' });
    }

    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[renderer:${level}] ${sourceId}:${line} ${message}`);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    });

    win.webContents.on('did-fail-provisional-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('Failed provisional load:', errorCode, errorDescription, validatedURL);
    });

    win.webContents.on('render-process-gone', (event, details) => {
        console.error('Render process gone:', details);
    });

    win.webContents.on('unresponsive', () => {
        console.error('Renderer became unresponsive');
    });

    win.webContents.session.webRequest.onErrorOccurred((details) => {
        console.error('[request failed]', details.error, details.method, details.url);
    });

    async function navigateCleanly(url) {
        if (pendingNavigationUrl === url) return;
        pendingNavigationUrl = url;

        await stopPageMediaStreams(win.webContents);
        navigationStartedByShell = true;
        await win.loadURL('about:blank');
        await new Promise(resolve => setTimeout(resolve, 1000));

        navigationStartedByShell = true;
        await win.loadURL(url);
        pendingNavigationUrl = null;
    }

    win.webContents.on('will-navigate', (event, url) => {
        if (navigationStartedByShell) {
            navigationStartedByShell = false;
            return;
        }

        if (!url.startsWith(REMOTE_SERVER)) {
            return;
        }

        event.preventDefault();
        navigateCleanly(url).catch(error => {
            console.error('Clean navigation failed:', error);
            pendingNavigationUrl = null;
        });
    });

    win.webContents.on('did-finish-load', () => {
        injectMediaCleanup(win.webContents);
        injectRendererDiagnostics(win.webContents);
        console.log('Loaded:', win.webContents.getURL());
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        navigateCleanly(url).catch(error => {
            console.error('Clean window-open navigation failed:', error);
        });
        return { action: 'deny' };
    });

    navigationStartedByShell = true;
    win.loadURL(`${REMOTE_SERVER}/smartgames.html`);
}

app.whenReady().then(() => {
    setupMediapipeProtocol();
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
