const { contextBridge, ipcRenderer } = require('electron');

// Expose methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
    setWindowSize: (width, height, compact) => ipcRenderer.send('set-window-size', { width, height, compact })
});
