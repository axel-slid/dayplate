const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Store = require('./lib/store.cjs');
app.setPath('userData', path.join(app.getPath('appData'), 'dayplate'));
if (process.env.DAYPLATE_TEST_DATA) app.setPath('userData', process.env.DAYPLATE_TEST_DATA);
if (process.env.DAYPLATE_DATA_DIR) app.setPath('userData', process.env.DAYPLATE_DATA_DIR);
const directory=app.getPath('userData');
let seenRevision=0;
if (!app.requestSingleInstanceLock()) {app.quit();} else {
ipcMain.on('journal:load',event=>{
  try {const data=Store.read(directory);seenRevision=data.revision;event.returnValue=data;} catch(error){event.returnValue={error:error.message};}
});
ipcMain.on('journal:save',(event,state,revision)=>{
  try{const data=Store.replace(directory,state,revision);seenRevision=data.revision;event.returnValue={ok:true,...data};}
  catch(error){let latest;try{latest=Store.read(directory);}catch{}event.returnValue={ok:false,error:error.message,...latest};}
});
function createWindow() {
  const win = new BrowserWindow({width: 1320, height: 900, minWidth: 900, minHeight: 680, title: 'Dayplate', icon: path.join(__dirname, 'assets/dayplate.png'), backgroundColor: '#fdfaf2', titleBarStyle: 'hiddenInset', webPreferences: {preload:path.join(__dirname,'preload.cjs'),nodeIntegration: false, contextIsolation: true, sandbox: true}});
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'src/index.html'));
}
app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.setIcon(path.join(__dirname, 'assets/dayplate.png'));
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  createWindow();
  fs.watchFile(Store.filename(directory),{interval:200,persistent:false},()=>{
    try{const data=Store.read(directory);if(data.state&&data.revision!==seenRevision){seenRevision=data.revision;for(const win of BrowserWindow.getAllWindows())win.webContents.send('journal:changed',data);}}
    catch(error){console.error('Journal update failed:',error.message);}
  });
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('second-instance',()=>{const win=BrowserWindow.getAllWindows()[0];if(win){if(win.isMinimized())win.restore();win.focus();}});
app.on('will-quit',()=>fs.unwatchFile(Store.filename(directory)));
}
