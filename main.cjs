// Draad for the desktop: draad.app itself in a window of its own, so the desktop app is always exactly
// the website, the moment it is deployed. The website's own service worker keeps visited pages and the
// books saved for offline reading; when nothing can load at all, offline.html says so and tries again.
const {app, BrowserWindow, nativeTheme, powerMonitor, session, shell} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const {autoUpdater} = require("electron-updater");

const siteUrl = "https://draad.app/";
// `npm run dev` (electron . --dev) shows the website's dev server instead (Projects/inverband, `yarn dev`).
const devUrl = process.argv.includes("--dev") ? process.env.DRAAD_DESKTOP_URL ?? "http://localhost:3000/" : null;
const startUrl = devUrl ?? siteUrl;
const ownHosts = new Set(["draad.app", "www.draad.app", new URL(startUrl).host]);
const offlinePage = path.join(__dirname, "offline.html");

if (!app.requestSingleInstanceLock()) app.quit();

// The website could tell it runs in the app from this (it does not need to yet).
app.userAgentFallback = `${app.userAgentFallback} DraadDesktop/${app.getVersion()}`;

/** Draad's own pages stay in the window; everything else opens in the browser. */
function isOwn(url) {
  try {
    const {protocol, host} = new URL(url);
    return (protocol === "https:" || protocol === "http:") && ownHosts.has(host);
  } catch {
    return false;
  }
}

function openOutside(url) {
  if (/^(https?|mailto|tel):/.test(url)) shell.openExternal(url);
}

// Where and how big the window was last time.
const stateFile = path.join(app.getPath("userData"), "window.json");

function loadBounds() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return {width: 1200, height: 860};
  }
}

function saveBounds(win) {
  try {
    fs.writeFileSync(stateFile, JSON.stringify({...win.getNormalBounds(), maximized: win.isMaximized()}));
  } catch {
    // Not being able to remember the window is no reason to stop.
  }
}

/** How long the window may be away before the page is loaded fresh. */
const staleAfter = 30 * 60 * 1000;

function createWindow() {
  const {maximized, ...bounds} = loadBounds();
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 360,
    minHeight: 520,
    title: "Draad",
    autoHideMenuBar: true,
    // The website's background (globals.css), so there is no white flash before the first paint.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#111722" : "#fbf6ee",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true},
  });
  if (maximized) win.maximize();
  win.on("close", () => saveBounds(win));

  win.webContents.setWindowOpenHandler(({url}) => {
    if (isOwn(url)) win.loadURL(url);
    else openOutside(url);
    return {action: "deny"};
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isOwn(url) || url.startsWith("file:")) return;
    event.preventDefault();
    openOutside(url);
  });

  // No network and the page was never visited (else the service worker answers): the offline page.
  win.webContents.on("did-fail-load", (_event, code, _description, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted, e.g. a new navigation */) return;
    win.loadFile(offlinePage, {query: {retry: isOwn(url) ? url : startUrl}});
  });

  // The mouse's back and forward buttons, and Alt+Left / Alt+Right, as in a browser.
  const history = win.webContents.navigationHistory;
  win.on("app-command", (_event, command) => {
    if (command === "browser-backward" && history.canGoBack()) history.goBack();
    if (command === "browser-forward" && history.canGoForward()) history.goForward();
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !input.alt) return;
    if (input.key === "ArrowLeft" && history.canGoBack()) {
      history.goBack();
      event.preventDefault();
    } else if (input.key === "ArrowRight" && history.canGoForward()) {
      history.goForward();
      event.preventDefault();
    }
  });

  // Back after a long time away (window hidden, or the computer asleep): load the page again, so a
  // deploy made meanwhile is there at once. Pages always come from draad.app, so this is the only staleness.
  let away = 0;
  const leave = () => (away = Date.now());
  const back = () => {
    if (away && Date.now() - away > staleAfter && isOwn(win.webContents.getURL())) win.webContents.reload();
    away = 0;
  };
  win.on("hide", leave);
  win.on("minimize", leave);
  win.on("show", back);
  win.on("restore", back);
  powerMonitor.on("suspend", leave);
  powerMonitor.on("resume", back);
  win.on("closed", () => {
    powerMonitor.off("suspend", leave);
    powerMonitor.off("resume", back);
  });

  win.loadURL(startUrl);
  return win;
}

app.whenReady().then(() => {
  // The window around the site updates itself from the GitHub releases (.github/workflows/desktop.yml),
  // quietly: downloaded in the background, installed when Draad closes. Only in the installed app.
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
  // The computer's languages, so the website opens in the reader's own language as in their browser.
  session.defaultSession.setUserAgent(app.userAgentFallback, app.getPreferredSystemLanguages().join(","));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("second-instance", () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
