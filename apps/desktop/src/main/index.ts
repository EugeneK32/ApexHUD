import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  protocol,
  screen,
  shell,
  Tray,
} from "electron";
import path from "node:path";
import type {
  AppPreferences,
  HotkeyAction,
  HotkeyMap,
  LayoutScenario,
  LayoutWorkspace,
} from "@apexhud/protocol";
import { LayoutStore } from "./layoutStore.js";
import { ModuleCatalog } from "./moduleCatalog.js";
import { TelemetryProcess } from "./telemetryProcess.js";
import { IRacingDisplayManager } from "./iracingDisplayManager.js";
import {
  DEFAULT_HOTKEYS,
  PreferencesStore,
  sanitizePreferences,
} from "./preferencesStore.js";
import { CommunityModuleService } from "./communityModuleService.js";
import { resolveInterfaceScale } from "../shared/scaling.js";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "apex-module",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
]);

app.setName("ApexHUD");
if (process.platform === "win32") {
  app.setAppUserModelId("com.apexhud.desktop");
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.exit(0);
}

let splashWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let controlWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let pendingShowControlCenter = false;
let editMode = false;
let overlayVisible = true;
let sessionActive = false;
let overlayTopmostTimer: NodeJS.Timeout | null = null;
let communityUpdateTimer: NodeJS.Timeout | null = null;
let communityInitialTimer: NodeJS.Timeout | null = null;
let preferences: AppPreferences = {
  schemaVersion: 5,
  locale: "en",
  interfaceScale: "auto",
  hudScale: "interface",
  overlayAutoHideMode: "not-foreground",
  communityRepositoryUrl: "https://github.com/EugeneK32/apexhud-community-modules.git",
  communityBranch: "main",
  autoCheckCommunityUpdates: true,
  hotkeys: structuredClone(DEFAULT_HOTKEYS),
};

const telemetryUrl =
  process.env.APEXHUD_TELEMETRY_URL ?? "ws://127.0.0.1:47931/ws";
const modules = new ModuleCatalog();
const layoutStore = new LayoutStore();
const telemetry = new TelemetryProcess();
const iracingDisplay = new IRacingDisplayManager();
const preferencesStore = new PreferencesStore();
const community = new CommunityModuleService(modules);

if (singleInstance) {
  app.on("second-instance", () => {
    pendingShowControlCenter = true;
    showControlCenter();
  });

  app.whenReady().then(async () => {
    await createSplashWindow();
    modules.registerProtocolHandler();
    const [, loadedPreferences] = await Promise.all([
      modules.reload(),
      preferencesStore.get(),
    ]);
    preferences = loadedPreferences;
    registerIpc();

    const failedHotkeys = registerHotkeys(preferences.hotkeys);
    if (failedHotkeys.length > 0) {
      preferences = await preferencesStore.save({
        ...preferences,
        hotkeys: structuredClone(DEFAULT_HOTKEYS),
      });
      registerHotkeys(preferences.hotkeys);
    }

    createTray();
    const telemetryStartup = telemetry.start().catch((error) => {
      console.error("Telemetry service could not start", error);
    });
    await createWindows();
    void telemetryStartup;
    scheduleCommunityUpdates();
  }).catch((error) => {
    console.error("ApexHUD startup failed", error);
    closeSplash();
    app.quit();
  });

  app.on("before-quit", () => {
    isQuitting = true;
    stopOverlayTopmostGuard();
    stopCommunityUpdates();
    telemetry.stop();
    closeSplash();
    globalShortcut.unregisterAll();
  });

  app.on("window-all-closed", () => {
    // The tray keeps ApexHUD running when the control window is closed.
  });

  app.on("activate", () => {
    showControlCenter();
  });
}

async function createSplashWindow(): Promise<void> {
  splashWindow = new BrowserWindow({
    width: 430,
    height: 244,
    useContentSize: true,
    center: true,
    frame: false,
    resizable: false,
    movable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    backgroundColor: "#0d1116",
    icon: appIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  splashWindow.on("closed", () => {
    splashWindow = null;
  });
  await loadRenderer(splashWindow, "splash.html");
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.show();
  }
}

function closeSplash(): void {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.close();
  splashWindow = null;
}

async function createWindows(): Promise<void> {
  const preload = path.join(
    app.getAppPath(),
    "dist-main",
    "preload",
    "index.cjs",
  );
  const primaryBounds = screen.getPrimaryDisplay().bounds;

  overlayWindow = new BrowserWindow({
    ...primaryBounds,
    icon: appIconPath(),
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  ensureOverlayTopmost();
  startOverlayTopmostGuard();
  setOverlayMousePassthrough(true);
  overlayWindow.setFocusable(false);
  overlayWindow.once("ready-to-show", () => {
    applyOverlayVisibility();
  });

  controlWindow = new BrowserWindow({
    width: 1180,
    icon: appIconPath(),
    height: 780,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: "#090b12",
    title: "ApexHUD Control Center",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      partition: "persist:apexhud-control",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  // The Control Center uses an isolated Electron session so its browser zoom
  // cannot affect the overlay. Custom protocols are session-scoped, therefore
  // module previews must be registered in this session as well.
  modules.registerProtocolHandler(controlWindow.webContents.session);

  controlWindow.webContents.on("did-finish-load", applyControlInterfaceScale);
  controlWindow.on("move", applyControlInterfaceScale);
  controlWindow.once("ready-to-show", () => {
    closeSplash();
    controlWindow?.show();
    if (pendingShowControlCenter) {
      pendingShowControlCenter = false;
      showControlCenter();
    }
  });
  controlWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      controlWindow?.hide();
    }
  });

  await Promise.all([
    loadRenderer(controlWindow, "control.html"),
    loadRenderer(overlayWindow, "overlay.html"),
  ]);

  screen.on("display-metrics-changed", () => {
    syncOverlayBounds();
    applyControlInterfaceScale();
  });
  screen.on("display-added", () => {
    syncOverlayBounds();
    applyControlInterfaceScale();
  });
  screen.on("display-removed", () => {
    syncOverlayBounds();
    applyControlInterfaceScale();
  });
}

async function loadRenderer(
  window: BrowserWindow,
  page: "overlay.html" | "control.html" | "splash.html",
): Promise<void> {
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    await window.loadURL(`${devServer}/${page}`);
    return;
  }

  await window.loadFile(
    path.join(app.getAppPath(), "dist-renderer", page),
  );
}

function registerIpc(): void {
  ipcMain.handle("app:get-state", () => ({
    editMode,
    overlayVisible,
    sessionActive,
    telemetryUrl,
    userModulesPath: modules.userModulesPath,
    version: app.getVersion(),
    preferences,
  }));

  ipcMain.handle("modules:list", () => modules.list());
  ipcMain.handle("modules:reload", async () => {
    const catalog = await modules.reload();
    broadcast("modules:changed", catalog);
    return catalog;
  });
  ipcMain.handle("community:get", () => community.cached);
  ipcMain.handle("community:refresh", async () => {
    const state = await community.refresh(preferences);
    broadcast("community:changed", state);
    return state;
  });
  ipcMain.handle("community:install", async (_event, moduleId: string) => {
    const state = await community.install(String(moduleId), preferences);
    broadcast("modules:changed", modules.list());
    broadcast("community:changed", state);
    return state;
  });
  ipcMain.handle("community:uninstall", async (_event, moduleId: string) => {
    const state = await community.uninstall(String(moduleId), preferences);
    broadcast("modules:changed", modules.list());
    broadcast("community:changed", state);
    return state;
  });

  ipcMain.handle("layouts:get", () => layoutStore.get());
  ipcMain.handle(
    "layouts:save",
    async (_event, workspace: LayoutWorkspace) => {
      const saved = await layoutStore.save(workspace);
      broadcast("layouts:changed", saved);
      return saved;
    },
  );
  ipcMain.handle(
    "layouts:reset-profile",
    async (_event, groupId: string, scenario: LayoutScenario) => {
      const reset = await layoutStore.resetProfile(groupId, scenario);
      broadcast("layouts:changed", reset);
      return reset;
    },
  );
  ipcMain.handle("hotkeys:begin-capture", () => {
    globalShortcut.unregisterAll();
  });
  ipcMain.handle("hotkeys:end-capture", () => {
    registerHotkeys(preferences.hotkeys);
  });

  ipcMain.handle(
    "preferences:save",
    async (_event, next: AppPreferences) => {
      const candidate = sanitizePreferences(next);
      const previous = preferences;
      const failed = registerHotkeys(candidate.hotkeys);
      if (failed.length > 0) {
        registerHotkeys(previous.hotkeys);
        throw new Error(`Could not register: ${failed.join(", ")}`);
      }

      try {
        preferences = await preferencesStore.save(candidate);
      } catch (error) {
        registerHotkeys(previous.hotkeys);
        throw error;
      }
      applyControlInterfaceScale();
      broadcast("preferences:changed", preferences);
      scheduleCommunityUpdates();
      return preferences;
    },
  );

  ipcMain.handle("overlay:set-edit-mode", (_event, enabled: boolean) => {
    setEditMode(Boolean(enabled));
    return editMode;
  });

  ipcMain.handle("overlay:set-visible", (_event, visible: boolean) => {
    setOverlayVisible(Boolean(visible));
    return overlayVisible;
  });

  ipcMain.handle("overlay:set-session-active", (_event, active: boolean) => {
    setSessionActive(Boolean(active));
    return sessionActive;
  });

  ipcMain.handle("overlay:show-control", () => showControlCenter());
  ipcMain.handle("shell:open-modules", async () => {
    await shell.openPath(modules.userModulesPath);
  });
  ipcMain.handle("iracing:display-state", () => iracingDisplay.getState());
  ipcMain.handle("iracing:enable-borderless", async () => {
    if (sessionActive) {
      throw new Error("Close the iRacing simulator before changing display mode.");
    }
    return iracingDisplay.enableBorderless(screen.getPrimaryDisplay().bounds);
  });
  ipcMain.handle("app:quit", () => app.quit());
}

function registerHotkeys(hotkeys: HotkeyMap): HotkeyAction[] {
  globalShortcut.unregisterAll();
  const failed: HotkeyAction[] = [];
  const handlers: Record<HotkeyAction, () => void> = {
    editLayout: () => setEditMode(!editMode),
    toggleOverlay: () => setOverlayVisible(!overlayVisible),
    openControlCenter: () => showControlCenter(),
  };

  for (const action of Object.keys(handlers) as HotkeyAction[]) {
    try {
      if (!globalShortcut.register(hotkeys[action], handlers[action])) {
        failed.push(action);
      }
    } catch {
      failed.push(action);
    }
  }

  if (failed.length > 0) {
    globalShortcut.unregisterAll();
  }
  return failed;
}

function appIconPath(): string {
  return path.join(app.getAppPath(), "assets", "app-icon.ico");
}

function brandImagePath(): string {
  return path.join(app.getAppPath(), "assets", "app-icon.png");
}

function createTray(): void {
  const source = nativeImage.createFromPath(brandImagePath());
  const icon = source.resize({ width: 16, height: 16, quality: "best" });
  tray = new Tray(icon);
  tray.setToolTip("ApexHUD");
  tray.on("double-click", showControlCenter);
  rebuildTrayMenu();
}

function rebuildTrayMenu(): void {
  if (!tray) {
    return;
  }

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open Control Center",
        click: showControlCenter,
      },
      {
        label: editMode ? "Finish layout editing" : "Edit overlay layout",
        click: () => setEditMode(!editMode),
      },
      {
        label: "Show overlay",
        type: "checkbox",
        checked: overlayVisible,
        click: (item) => setOverlayVisible(item.checked),
      },
      { type: "separator" },
      {
        label: "Quit ApexHUD",
        click: () => app.quit(),
      },
    ]),
  );
}

function setEditMode(enabled: boolean): void {
  editMode = enabled;
  overlayWindow?.setFocusable(enabled);
  setOverlayMousePassthrough(!enabled);

  if (enabled) {
    applyOverlayVisibility();
    overlayWindow?.focus();
  } else {
    // Do not let the editor stealing foreground mark the active iRacing
    // session as inactive. Releasing focus first returns control to the sim,
    // then the normal visibility rule keeps the race overlay alive.
    overlayWindow?.blur();
    applyOverlayVisibility();
  }

  broadcast("overlay:edit-mode-changed", editMode);
  rebuildTrayMenu();
}

function setOverlayVisible(visible: boolean): void {
  overlayVisible = visible;
  if (!visible && editMode) {
    editMode = false;
    setOverlayMousePassthrough(true);
    broadcast("overlay:edit-mode-changed", false);
  }
  applyOverlayVisibility();
  broadcast("overlay:visibility-changed", overlayVisible);
  rebuildTrayMenu();
}

function setSessionActive(active: boolean): void {
  // The transparent editor becomes the foreground window while it is open.
  // Ignore that temporary false state so Done can return to the live overlay.
  if (editMode && !active) return;
  if (sessionActive === active) return;

  sessionActive = active;
  applyOverlayVisibility();
  broadcast("overlay:session-active-changed", sessionActive);
}

function applyOverlayVisibility(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const shouldShow = editMode || (overlayVisible && sessionActive);
  if (!shouldShow) {
    overlayWindow.hide();
    return;
  }

  if (editMode) {
    overlayWindow.show();
  } else {
    overlayWindow.showInactive();
  }

  ensureOverlayTopmost();
}

function ensureOverlayTopmost(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  // screen-saver is the highest Electron level available on Windows.
  // It works over normal and borderless fullscreen windows without taking focus.
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  if (overlayWindow.isVisible()) {
    overlayWindow.moveTop();
  }
}

function startOverlayTopmostGuard(): void {
  stopOverlayTopmostGuard();
  overlayTopmostTimer = setInterval(() => {
    if (editMode || (overlayVisible && sessionActive)) {
      ensureOverlayTopmost();
    }
  }, 1500);
  overlayTopmostTimer.unref?.();
}

function stopOverlayTopmostGuard(): void {
  if (overlayTopmostTimer) {
    clearInterval(overlayTopmostTimer);
    overlayTopmostTimer = null;
  }
}

function setOverlayMousePassthrough(ignore: boolean): void {
  if (!overlayWindow) {
    return;
  }

  if (process.platform === "win32") {
    overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  } else {
    overlayWindow.setIgnoreMouseEvents(ignore);
  }
}

function scheduleCommunityUpdates(): void {
  stopCommunityUpdates();
  if (!preferences.autoCheckCommunityUpdates) return;

  const run = async () => {
    const state = await community.refresh(preferences);
    broadcast("community:changed", state);
  };
  communityInitialTimer = setTimeout(() => {
    communityInitialTimer = null;
    void run();
  }, 20_000);
  communityInitialTimer.unref?.();
  communityUpdateTimer = setInterval(() => void run(), 6 * 60 * 60 * 1000);
  communityUpdateTimer.unref?.();
}

function stopCommunityUpdates(): void {
  if (communityInitialTimer) {
    clearTimeout(communityInitialTimer);
    communityInitialTimer = null;
  }
  if (communityUpdateTimer) {
    clearInterval(communityUpdateTimer);
    communityUpdateTimer = null;
  }
}


function applyControlInterfaceScale(): void {
  if (!controlWindow || controlWindow.isDestroyed()) return;
  const display = screen.getDisplayMatching(controlWindow.getBounds());
  const factor = resolveInterfaceScale(
    preferences.interfaceScale,
    display.bounds.width,
    display.bounds.height,
    display.scaleFactor,
  );
  controlWindow.webContents.setZoomFactor(factor);
}

function showControlCenter(): void {
  if (!controlWindow || controlWindow.isDestroyed()) {
    pendingShowControlCenter = true;
    return;
  }

  pendingShowControlCenter = false;
  controlWindow.show();
  if (controlWindow.isMinimized()) {
    controlWindow.restore();
  }
  controlWindow.focus();
}

function syncOverlayBounds(): void {
  const bounds = screen.getPrimaryDisplay().bounds;
  overlayWindow?.setBounds(bounds, false);
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of [overlayWindow, controlWindow]) {
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}
