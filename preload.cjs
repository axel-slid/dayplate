const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('dayplateStore',{
  load:()=>ipcRenderer.sendSync('journal:load'),
  save:(state,revision)=>ipcRenderer.sendSync('journal:save',state,revision),
  onChange:callback=>{ipcRenderer.on('journal:changed',(_event,data)=>callback(data));}
});
