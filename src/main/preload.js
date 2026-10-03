const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  copyPrompt: (text) => ipcRenderer.invoke('prompt:copy', text),
  listRecords: () => ipcRenderer.invoke('record:list'),
  addRecord: (rec) => ipcRenderer.invoke('record:add', rec),
  deleteRecord: (id) => ipcRenderer.invoke('record:delete', id),
  saveQr: (dataURL) => ipcRenderer.invoke('qr:save', dataURL),
  hideWindow: () => ipcRenderer.invoke('win:hide'),
  showMainWindow: () => ipcRenderer.invoke('main:show'),
  showFloating: () => ipcRenderer.invoke('float:show'),
  hideFloating: () => ipcRenderer.invoke('float:hide'),
  toggleFloating: () => ipcRenderer.invoke('float:toggle'),
  floatDragStart: (x, y) => ipcRenderer.send('float:drag-start', { x, y }),
  floatDragMove: (x, y) => ipcRenderer.send('float:drag-move', { x, y }),
  floatDragEnd: () => ipcRenderer.send('float:drag-end'),
  sendToDeepSeek: (text) => ipcRenderer.invoke('deepseek:send', text),
  fillToDeepSeek: (text) => ipcRenderer.invoke('deepseek:fill', text),
  pollDeepSeekAnswer: () => ipcRenderer.invoke('deepseek:poll-answer'),
  copyQrImage: (dataURL) => ipcRenderer.invoke('qr:copy', dataURL),
  ocrAnalyze: (payload) => ipcRenderer.invoke('ocr:analyze', payload),
  minimizeWindow: () => ipcRenderer.invoke('win:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('win:maximize'),
  toggleTop: () => ipcRenderer.invoke('win:toggleTop'),
  quitApp: () => ipcRenderer.invoke('win:quit')
});
