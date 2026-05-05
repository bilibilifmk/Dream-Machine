const { app, BrowserWindow } = require('electron')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 600,
    minWidth: 1024,
    maxWidth: 1024,
    minHeight: 600,
    maxHeight: 600,
    frame: false,
    titleBarStyle: 'hidden'
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
  const { Menu } = require('electron');
  Menu.setApplicationMenu(null);
  // hide menu for Mac 
  if (process.platform !== 'darwin') {
    app.dock.hide();
  }
})

