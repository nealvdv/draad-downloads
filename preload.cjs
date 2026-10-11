// Tells the page it runs inside the desktop app (window.draadDesktop), nothing more: no Node access in the page.
const {contextBridge} = require("electron");

contextBridge.exposeInMainWorld("draadDesktop", {platform: process.platform});
