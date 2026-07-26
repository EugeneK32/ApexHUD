import type {
  AppPreferences,
  CommunityCatalogState,
  DiscoveredModule,
  LayoutScenario,
  LayoutWorkspace,
} from "@apexhud/protocol";

export interface DisplayCompatibilityState {
  found: boolean;
  path: string;
  fullScreenExclusive: boolean;
  borderless: boolean;
  message: string;
}

export interface AppRuntimeState {
  editMode: boolean;
  overlayVisible: boolean;
  sessionActive: boolean;
  telemetryUrl: string;
  userModulesPath: string;
  version: string;
  preferences: AppPreferences;
}

export interface ApexDesktopBridge {
  getState(): Promise<AppRuntimeState>;
  listModules(): Promise<DiscoveredModule[]>;
  reloadModules(): Promise<DiscoveredModule[]>;
  getCommunityCatalog(): Promise<CommunityCatalogState>;
  refreshCommunityCatalog(): Promise<CommunityCatalogState>;
  installCommunityModule(moduleId: string): Promise<CommunityCatalogState>;
  uninstallCommunityModule(moduleId: string): Promise<CommunityCatalogState>;
  getLayoutWorkspace(): Promise<LayoutWorkspace>;
  saveLayoutWorkspace(workspace: LayoutWorkspace): Promise<LayoutWorkspace>;
  resetLayoutProfile(groupId: string, scenario: LayoutScenario): Promise<LayoutWorkspace>;
  savePreferences(preferences: AppPreferences): Promise<AppPreferences>;
  beginHotkeyCapture(): Promise<void>;
  endHotkeyCapture(): Promise<void>;
  setEditMode(enabled: boolean): Promise<boolean>;
  setOverlayVisible(visible: boolean): Promise<boolean>;
  setSessionActive(active: boolean): Promise<boolean>;
  showControlCenter(): Promise<void>;
  openModulesFolder(): Promise<void>;
  getIRacingDisplayState(): Promise<DisplayCompatibilityState>;
  enableIRacingBorderless(): Promise<DisplayCompatibilityState>;
  quit(): Promise<void>;
  onEditModeChanged(listener: (enabled: boolean) => void): () => void;
  onOverlayVisibilityChanged(listener: (visible: boolean) => void): () => void;
  onSessionActiveChanged(listener: (active: boolean) => void): () => void;
  onLayoutWorkspaceChanged(listener: (workspace: LayoutWorkspace) => void): () => void;
  onPreferencesChanged(listener: (preferences: AppPreferences) => void): () => void;
  onModulesChanged(listener: (modules: DiscoveredModule[]) => void): () => void;
  onCommunityCatalogChanged(listener: (state: CommunityCatalogState) => void): () => void;
}

declare global {
  interface Window {
    apexDesktop: ApexDesktopBridge;
  }
}
