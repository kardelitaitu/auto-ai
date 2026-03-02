const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

let mainWindow;

const configPath = path.join(app.getPath('userData'), 'window-config.json');

function loadWindowBounds() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load window config:', err);
  }
  return null;
}

function saveWindowBounds() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    const isMaximized = mainWindow.isMaximized();
    fs.writeFileSync(configPath, JSON.stringify({ bounds, isMaximized }));
  } catch (err) {
    console.error('Failed to save window config:', err);
  }
}

function createWindow() {
  const config = loadWindowBounds();
  
   const windowOptions = {
     width: config?.bounds?.width || 1200,
     height: config?.bounds?.height || 800,
     x: config?.bounds?.x,
     y: config?.bounds?.y,
     minWidth: 600,
     minHeight: 400,
      icon: path.join(__dirname, 'icon.ico'),
     backgroundColor: '#0d0d14',
     autoHideMenuBar: true,
     webPreferences: {
       nodeIntegration: false,
       contextIsolation: true,
        preload: path.join(__dirname, 'preload.cjs')
     },
     resizable: true,
     title: 'Auto-AI Dashboard',
     show: false
   };

  mainWindow = new BrowserWindow(windowOptions);

  if (config?.isMaximized) {
    mainWindow.maximize();
  }

   // Load React build directly (doesn't require Express server)
   const reactPath = path.join(__dirname, 'renderer', 'dist', 'index.html');
   mainWindow.loadFile(reactPath).catch(err => {
     console.error('Failed to load React app:', err);
     // Fallback: show error page
     mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
       <html><body style="background:#000;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
         <div style="text-align:center;">
           <h1>Dashboard Build Missing</h1>
           <p>Run: <code>cd renderer && npm run build</code></p>
         </div>
       </body></html>
     `));
   });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', saveWindowBounds);
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in Electron main process:', error);
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection in Electron main process:', reason);
  app.quit();
});
