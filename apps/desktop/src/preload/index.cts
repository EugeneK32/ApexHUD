import { contextBridge, ipcRenderer } from "electron";
import type {
  AppPreferences,
  CommunityCatalogState,
  DiscoveredModule,
  LayoutScenario,
  LayoutWorkspace,
} from "@apexhud/protocol";
import type {
  ApexDesktopBridge,
  AppRuntimeState,
} from "../shared/bridge.js";

function subscribe<T>(
  channel: string,
  listener: (payload: T) => void,
): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T) => {
    listener(payload);
  };

  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const bridge: ApexDesktopBridge = {
  getState: () =>
    ipcRenderer.invoke("app:get-state") as Promise<AppRuntimeState>,
  listModules: () =>
    ipcRenderer.invoke("modules:list") as Promise<DiscoveredModule[]>,
  reloadModules: () =>
    ipcRenderer.invoke("modules:reload") as Promise<DiscoveredModule[]>,
  getCommunityCatalog: () =>
    ipcRenderer.invoke("community:get") as Promise<CommunityCatalogState>,
  refreshCommunityCatalog: () =>
    ipcRenderer.invoke("community:refresh") as Promise<CommunityCatalogState>,
  installCommunityModule: (moduleId: string) =>
    ipcRenderer.invoke("community:install", moduleId) as Promise<CommunityCatalogState>,
  uninstallCommunityModule: (moduleId: string) =>
    ipcRenderer.invoke("community:uninstall", moduleId) as Promise<CommunityCatalogState>,
  getLayoutWorkspace: () =>
    ipcRenderer.invoke("layouts:get") as Promise<LayoutWorkspace>,
  saveLayoutWorkspace: (workspace) =>
    ipcRenderer.invoke("layouts:save", workspace) as Promise<LayoutWorkspace>,
  resetLayoutProfile: (groupId: string, scenario: LayoutScenario) =>
    ipcRenderer.invoke("layouts:reset-profile", groupId, scenario) as Promise<LayoutWorkspace>,
  savePreferences: (preferences) =>
    ipcRenderer.invoke("preferences:save", preferences) as Promise<AppPreferences>,
  setEditMode: (enabled) =>
    ipcRenderer.invoke("overlay:set-edit-mode", enabled) as Promise<boolean>,
  setOverlayVisible: (visible) =>
    ipcRenderer.invoke("overlay:set-visible", visible) as Promise<boolean>,
  setSessionActive: (active) =>
    ipcRenderer.invoke("overlay:set-session-active", active) as Promise<boolean>,
  showControlCenter: () =>
    ipcRenderer.invoke("overlay:show-control") as Promise<void>,
  openModulesFolder: () =>
    ipcRenderer.invoke("shell:open-modules") as Promise<void>,
  getIRacingDisplayState: () =>
    ipcRenderer.invoke("iracing:display-state"),
  enableIRacingBorderless: () =>
    ipcRenderer.invoke("iracing:enable-borderless"),
  quit: () => ipcRenderer.invoke("app:quit") as Promise<void>,
  onEditModeChanged: (listener) =>
    subscribe<boolean>("overlay:edit-mode-changed", listener),
  onOverlayVisibilityChanged: (listener) =>
    subscribe<boolean>("overlay:visibility-changed", listener),
  onSessionActiveChanged: (listener) =>
    subscribe<boolean>("overlay:session-active-changed", listener),
  onLayoutWorkspaceChanged: (listener) =>
    subscribe<LayoutWorkspace>("layouts:changed", listener),
  onPreferencesChanged: (listener) =>
    subscribe<AppPreferences>("preferences:changed", listener),
  onModulesChanged: (listener) =>
    subscribe<DiscoveredModule[]>("modules:changed", listener),
  onCommunityCatalogChanged: (listener) =>
    subscribe<CommunityCatalogState>("community:changed", listener),
};

contextBridge.exposeInMainWorld("apexDesktop", bridge);
