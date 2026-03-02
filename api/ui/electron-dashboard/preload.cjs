const { contextBridge, ipcRenderer } = require('electron');

// Expose methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Placeholder for future IPC methods if needed
  // For now, we're using WebSocket directly
});