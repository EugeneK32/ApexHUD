import {
  LAYOUT_SCENARIOS,
  type AppLocale,
  type CommunityCatalogState,
  type CommunityModuleEntry,
  type DiscoveredModule,
  type HotkeyAction,
  type HudScale,
  type InterfaceScale,
  type LayoutDocument,
  type LayoutScenario,
  type LayoutTarget,
  type LayoutWorkspace,
  type TelemetrySnapshot,
} from "@apexhud/protocol";
import type { AppRuntimeState } from "../../shared/bridge";
import { escapeHtml, formatDuration } from "../shared/format";
import { scenarioFromTelemetry } from "../shared/layoutScenario";
import {
  activeLayoutGroup,
  commitLayoutForScenario,
  copyLayoutBetweenTargets,
  createLayoutGroup,
  duplicateLayoutGroup,
  layoutForScenario,
  resetCurrentProfileToBase,
} from "../shared/layoutWorkspace";
import {
  scenarioLabel,
  SUPPORTED_LOCALES,
  translate,
  type TranslationKey,
} from "../shared/i18n";
import { TelemetryClient, type TelemetryStatus } from "../shared/telemetryClient";
import appIconUrl from "../../../assets/app-icon.png";
import "./control.css";

type ControlTab = "overview" | "layouts" | "widgets" | "settings";
type WidgetView = "installed" | "discover";
type SettingsSection = "general" | "overlay" | "integrations" | "hotkeys";

const TAB_META: Record<ControlTab, { title: TranslationKey; description: TranslationKey }> = {
  overview: { title: "overview", description: "overviewDescription" },
  layouts: { title: "layouts", description: "layoutsDescription" },
  widgets: { title: "moduleLibrary", description: "moduleLibraryDescription" },
  settings: { title: "settings", description: "settingsDescription" },
};

class ControlCenterApplication {
  private state!: AppRuntimeState;
  private modules: DiscoveredModule[] = [];
  private workspace!: LayoutWorkspace;
  private currentLayout!: LayoutDocument;
  private community!: CommunityCatalogState;
  private selectedScenario: LayoutScenario = "default";
  private profilePinned = false;
  private activeTab: ControlTab = "overview";
  private widgetView: WidgetView = "installed";
  private settingsSection: SettingsSection = "general";
  private latestFrame: TelemetrySnapshot | undefined;
  private telemetryStatus: TelemetryStatus = "connecting";
  private telemetry!: TelemetryClient;
  private moduleSearch = "";
  private moduleOrigin = "all";
  private communityBusy = new Set<string>();
  private hotkeyCapture: HotkeyAction | undefined;

  private readonly app = document.querySelector<HTMLDivElement>("#app");

  private get locale(): AppLocale {
    return this.state.preferences.locale;
  }

  private t(key: TranslationKey, vars?: Record<string, string | number>): string {
    return translate(this.locale, key, vars);
  }

  private scenario(scenario: LayoutScenario): string {
    return scenarioLabel(this.locale, scenario);
  }

  public async start(): Promise<void> {
    if (!this.app) throw new Error("Control center root is missing");

    [this.state, this.modules, this.workspace, this.community] = await Promise.all([
      window.apexDesktop.getState(),
      window.apexDesktop.listModules(),
      window.apexDesktop.getLayoutWorkspace(),
      window.apexDesktop.getCommunityCatalog(),
    ]);

    this.refreshCurrentLayout();
    this.renderShell();
    this.renderAll();
    void this.updateDisplayCompatibility();

    this.telemetry = new TelemetryClient(
      this.state.telemetryUrl,
      (frame) => this.onTelemetry(frame),
      (status) => {
        this.telemetryStatus = status;
        this.renderTelemetry();
      },
    );
    this.telemetry.start();

    window.apexDesktop.onEditModeChanged((enabled) => {
      this.state.editMode = enabled;
      this.renderActions();
    });
    window.apexDesktop.onOverlayVisibilityChanged((visible) => {
      this.state.overlayVisible = visible;
      this.renderActions();
    });
    window.apexDesktop.onSessionActiveChanged((active) => {
      this.state.sessionActive = active;
      this.renderActions();
    });
    window.apexDesktop.onLayoutWorkspaceChanged((workspace) => {
      this.workspace = workspace;
      this.refreshCurrentLayout();
      this.renderLayouts();
      this.renderWidgets();
      this.renderOverview();
    });
    window.apexDesktop.onPreferencesChanged((preferences) => {
      const languageChanged = preferences.locale !== this.state.preferences.locale;
      this.state.preferences = preferences;
      if (languageChanged) {
        this.renderShell();
        this.renderAll();
      } else {
        this.renderSettings();
      }
    });
    window.apexDesktop.onModulesChanged((modules) => {
      this.modules = modules;
      this.renderWidgets();
      this.renderOverview();
    });
    window.apexDesktop.onCommunityCatalogChanged((community) => {
      this.community = community;
      this.renderWidgets();
      this.renderSettings();
    });
  }

  private renderShell(): void {
    document.documentElement.lang = this.locale;
    this.app!.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand"><img class="brand-mark" src="${appIconUrl}" alt="" /><span><b>APEXHUD</b><small>iRacing overlay</small></span></div>
          <nav class="tab-nav" aria-label="${escapeHtml(this.t("controlCenter"))}">
            ${this.tabButton("overview", "overview")}
            ${this.tabButton("layouts", "layouts")}
            ${this.tabButton("widgets", "moduleLibrary")}
            ${this.tabButton("settings", "settings")}
          </nav>
          <div class="sidebar-status"><span id="sidebar-source-dot"></span><div><b id="sidebar-source">${escapeHtml(this.t("waiting"))}</b><small id="sidebar-track">${escapeHtml(this.t("noActiveSession"))}</small></div></div>
          <div class="sidebar-bottom"><span>ApexHUD ${escapeHtml(this.state.version)}</span><button id="quit-button" class="text-button danger">${escapeHtml(this.t("quit"))}</button></div>
        </aside>
        <main class="content">
          <header class="topbar">
            <div><div class="kicker">${escapeHtml(this.t("controlCenter"))}</div><h1 id="page-title"></h1><p id="page-description"></p></div>
            <div class="top-actions"><button id="overlay-button" class="button secondary"></button><button id="edit-button" class="button primary"></button></div>
          </header>
          <section class="tab-panel" data-panel="overview"><div id="overview-root"></div></section>
          <section class="tab-panel" data-panel="layouts"><div id="layouts-root"></div></section>
          <section class="tab-panel" data-panel="widgets"><div id="widgets-root"></div></section>
          <section class="tab-panel" data-panel="settings"><div id="settings-root"></div></section>
        </main>
      </div>`;

    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-tab]")) {
      button.addEventListener("click", () => this.openTab(button.dataset.tab as ControlTab));
    }
    this.element<HTMLButtonElement>("quit-button").addEventListener("click", () => void window.apexDesktop.quit());
    this.element<HTMLButtonElement>("edit-button").addEventListener("click", () => void window.apexDesktop.setEditMode(!this.state.editMode));
    this.element<HTMLButtonElement>("overlay-button").addEventListener("click", () => void window.apexDesktop.setOverlayVisible(!this.state.overlayVisible));
  }

  private renderAll(): void {
    this.openTab(this.activeTab);
    this.renderOverview();
    this.renderLayouts();
    this.renderWidgets();
    this.renderSettings();
    this.renderTelemetry();
    this.renderActions();
  }

  private openTab(tab: ControlTab): void {
    if (tab !== "settings") this.cancelHotkeyCapture();
    this.activeTab = tab;
    for (const button of document.querySelectorAll<HTMLElement>("[data-tab]")) {
      button.classList.toggle("active", button.dataset.tab === tab);
    }
    for (const panel of document.querySelectorAll<HTMLElement>("[data-panel]")) {
      panel.classList.toggle("active", panel.dataset.panel === tab);
    }
    this.element("page-title").textContent = this.t(TAB_META[tab].title);
    this.element("page-description").textContent = this.t(TAB_META[tab].description);
    if (tab === "widgets" && this.widgetView === "discover" && this.community.entries.length === 0 && !this.community.error) {
      void this.refreshCommunity();
    }
  }

  private renderOverview(): void {
    const group = activeLayoutGroup(this.workspace);
    const enabled = this.currentLayout.instances.filter((instance) => instance.enabled).length;
    this.element("overview-root").innerHTML = `
      <div class="home-rework">
        <article class="home-rework-hero panel">
          <div class="hero-main-column">
            <div class="home-status-line"><span id="home-source-dot" class="home-live-dot"></span><b id="source-title">${escapeHtml(this.t("waitingForIRacing"))}</b><span id="source-badge" class="status-badge">${escapeHtml(this.t("waiting").toUpperCase())}</span></div>
            <p id="source-description" class="hero-description">${escapeHtml(this.t("telemetryReady"))}</p>
            <div class="hero-track-block">
              <small>${escapeHtml(this.t("track"))}</small>
              <h2 id="track-name">—</h2>
            </div>
            <div class="hero-stats-grid">
              <div><span>${escapeHtml(this.t("session"))}</span><b id="session-type">—</b></div>
              <div><span>${escapeHtml(this.t("remaining"))}</span><b id="session-time">—</b></div>
              <div><span>${escapeHtml(this.t("field"))}</span><b id="field-size">—</b></div>
            </div>
          </div>
          <aside class="hero-side-column">
            <div class="hero-side-heading">
              <b>${escapeHtml(this.t("controlCenter"))}</b>
              <p>${escapeHtml(this.t("overviewDescription"))}</p>
            </div>
            <div class="hero-side-actions">
              <button id="overview-layouts" class="action-panel"><div><b>${escapeHtml(this.t("configureLayouts"))}</b><small>${escapeHtml(this.t("chooseSessionLayout"))}</small></div></button>
              <button id="overview-widgets" class="action-panel"><div><b>${escapeHtml(this.t("moduleLibrary"))}</b><small>${escapeHtml(this.t("browseInstalled"))}</small></div></button>
              <button id="overview-settings" class="action-panel"><div><b>${escapeHtml(this.t("settings"))}</b><small>${escapeHtml(this.t("settingsDescription"))}</small></div></button>
            </div>
          </aside>
        </article>

        <section class="home-summary-strip" aria-label="${escapeHtml(this.t("activeLayout"))}">
          <article class="summary-card-simple"><small>${escapeHtml(this.t("activeLayout"))}</small><b>${escapeHtml(group.name)}</b></article>
          <article class="summary-card-simple"><small>${escapeHtml(this.t("sessionLayout"))}</small><b>${escapeHtml(this.scenario(this.selectedScenario))}</b></article>
          <article class="summary-card-simple"><small>${escapeHtml(this.t("widgets"))}</small><b>${escapeHtml(String(enabled))}</b></article>
          <article class="summary-card-simple summary-card-live"><small>${escapeHtml(this.t("telemetry"))}</small><b>iRacing</b></article>
        </section>
      </div>`;

    this.element("overview-layouts").addEventListener("click", () => this.openTab("layouts"));
    this.element("overview-widgets").addEventListener("click", () => { this.widgetView = "installed"; this.openTab("widgets"); this.renderWidgets(); });
    this.element("overview-settings").addEventListener("click", () => this.openTab("settings"));
    this.renderTelemetry();
  }

  private renderLayouts(): void {
    const root = this.element("layouts-root");
    const group = activeLayoutGroup(this.workspace);
    const profile = group.profiles[this.selectedScenario];
    const localChanges = this.selectedScenario === "default"
      ? 0
      : profile.layout.instances.length
        + Object.keys(profile.baseOverrides ?? {}).length
        + (profile.hiddenBaseInstanceIds?.length ?? 0);

    root.innerHTML = `
      <div class="layout-journey">
        <section class="journey-step panel">
          <header class="journey-header"><span class="step-number">1</span><div><span class="panel-eyebrow">${escapeHtml(this.t("stepOne"))}</span><h2>${escapeHtml(this.t("chooseLayoutSet"))}</h2><p>${escapeHtml(this.t("layoutSetHint"))}</p></div></header>
          <div class="layout-set-row">
            <label class="field layout-set-select"><span>${escapeHtml(this.t("activeSet"))}</span><select id="group-select"></select></label>
            <div class="button-row set-actions"><button id="group-new" class="button secondary small">＋ ${escapeHtml(this.t("newSet"))}</button><details class="set-menu"><summary class="button ghost small">${escapeHtml(this.t("manageSet"))} ···</summary><div class="set-menu-popover"><button id="group-duplicate" class="menu-action">${escapeHtml(this.t("duplicate"))}</button><button id="group-rename" class="menu-action">${escapeHtml(this.t("rename"))}</button><button id="group-delete" class="menu-action danger">${escapeHtml(this.t("delete"))}</button></div></details></div>
          </div>
        </section>

        <section class="journey-step panel layout-picker-panel">
          <header class="journey-header"><span class="step-number">2</span><div><span class="panel-eyebrow">${escapeHtml(this.t("stepTwo"))}</span><h2>${escapeHtml(this.t("chooseSessionLayout"))}</h2><p>${escapeHtml(this.t("sessionLayoutHint"))}</p></div><label class="pin-toggle"><input id="profile-pin" type="checkbox" ${this.profilePinned ? "checked" : ""}/><span>${escapeHtml(this.t("keepSelection"))}</span></label></header>
          <div class="inheritance-flow">
            <button type="button" class="base-layout-card${this.selectedScenario === "default" ? " active" : ""}" data-scenario="default">
              <span class="layout-card-icon">B</span><span class="layout-card-copy"><small>${escapeHtml(this.t("baseFoundation"))}</small><b>${escapeHtml(this.t("baseLayout"))}</b><em>${escapeHtml(this.t("baseCardHint"))}</em></span><span class="layout-card-count">${escapeHtml(this.t("modulesCount", { count: group.profiles.default.layout.instances.length }))}</span>
            </button>
            <div class="inheritance-connector"><span></span><b>${escapeHtml(this.t("automaticSessionLayouts"))}</b><span></span></div>
            <div id="profile-cards" class="profile-cards"></div>
          </div>
          <div class="selected-layout-bar">
            <div><small>${escapeHtml(this.t("selectedLayout"))}</small><b>${escapeHtml(group.name)} · ${escapeHtml(this.scenario(this.selectedScenario))}</b><span>${escapeHtml(this.selectedScenario === "default" ? this.t("baseCardHint") : this.t("changesCount", { count: localChanges }))}</span></div>
            <div class="button-row"><button id="reset-to-base" class="button secondary" ${this.selectedScenario === "default" ? "disabled" : ""}>${escapeHtml(this.t("resetToBase"))}</button><button id="open-editor" class="button primary">${escapeHtml(this.t("editSelectedLayout"))}</button></div>
          </div>
        </section>

        <details class="copy-disclosure panel">
          <summary><span><b>${escapeHtml(this.t("copyLayout"))}</b><small>${escapeHtml(this.t("copyLayoutHint"))}</small></span><i>⌄</i></summary>
          <div class="copy-workflow">
            <div class="copy-side"><span class="copy-side-label">${escapeHtml(this.t("source"))}</span><label class="field"><span>${escapeHtml(this.t("sourceSet"))}</span><select id="copy-source-group"></select></label><label class="field"><span>${escapeHtml(this.t("sourceLayout"))}</span><select id="copy-source-profile"></select></label></div>
            <div class="copy-direction">→</div>
            <div class="copy-side"><span class="copy-side-label">${escapeHtml(this.t("target"))}</span><label class="field"><span>${escapeHtml(this.t("targetSet"))}</span><select id="copy-target-group"></select></label><label class="field"><span>${escapeHtml(this.t("targetLayout"))}</span><select id="copy-target-profile"></select></label></div>
            <button id="copy-layout" class="button primary copy-submit">${escapeHtml(this.t("copy"))}</button>
          </div>
        </details>
      </div>`;

    const groupSelect = this.element<HTMLSelectElement>("group-select");
    for (const candidate of this.workspace.groups) {
      groupSelect.append(option(candidate.id, candidate.name, candidate.id === group.id));
    }
    groupSelect.addEventListener("change", () => void this.switchGroup(groupSelect.value));

    this.element("group-new").addEventListener("click", () => void this.createGroup());
    this.element("group-duplicate").addEventListener("click", () => void this.duplicateGroup());
    this.element("group-rename").addEventListener("click", () => void this.renameGroup());
    this.element("group-delete").addEventListener("click", () => void this.deleteGroup());
    this.element("reset-to-base").addEventListener("click", () => void this.resetToBase());
    this.element("open-editor").addEventListener("click", () => void window.apexDesktop.setEditMode(true));
    this.element<HTMLInputElement>("profile-pin").addEventListener("change", (event) => {
      this.profilePinned = (event.currentTarget as HTMLInputElement).checked;
    });

    const baseCard = root.querySelector<HTMLButtonElement>('[data-scenario="default"]');
    baseCard?.addEventListener("click", () => void this.switchScenario("default"));

    const cards = this.element("profile-cards");
    for (const scenario of LAYOUT_SCENARIOS.filter((item) => item !== "default")) {
      const child = group.profiles[scenario];
      const changes = child.layout.instances.length
        + Object.keys(child.baseOverrides ?? {}).length
        + (child.hiddenBaseInstanceIds?.length ?? 0);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `session-layout-card${scenario === this.selectedScenario ? " active" : ""}`;
      button.innerHTML = `<span class="session-card-top"><b>${escapeHtml(this.scenario(scenario))}</b><em>${escapeHtml(this.t("inheritedFromBase"))}</em></span><span class="session-card-bottom">${escapeHtml(this.t("changesCount", { count: changes }))}</span>`;
      button.addEventListener("click", () => void this.switchScenario(scenario));
      cards.append(button);
    }

    this.fillTargetSelectors();
    this.element("copy-layout").addEventListener("click", () => void this.copyLayout());
  }

  private renderWidgets(): void {
    const root = document.getElementById("widgets-root");
    if (!root) return;
    root.innerHTML = `
      <div class="widget-hub-bar">
        <div class="segmented-control" role="tablist" aria-label="${escapeHtml(this.t("moduleLibrary"))}">
          <button type="button" class="segment${this.widgetView === "installed" ? " active" : ""}" data-widget-view="installed">${escapeHtml(this.t("myWidgets"))}</button>
          <button type="button" class="segment${this.widgetView === "discover" ? " active" : ""}" data-widget-view="discover">${escapeHtml(this.t("widgetCatalog"))}</button>
        </div>
        <div class="widget-hub-actions">
          ${this.widgetView === "installed"
            ? `<button id="library-edit-overlay" class="button primary">${escapeHtml(this.t("editOverlay"))}</button><details class="widget-more"><summary class="button ghost">···</summary><div><button id="open-modules-folder" class="menu-action">${escapeHtml(this.t("openFolder"))}</button><button id="reload-modules" class="menu-action">${escapeHtml(this.t("reload"))}</button></div></details>`
            : `<button id="refresh-community" class="button primary">${escapeHtml(this.t("checkUpdates"))}</button>`}
        </div>
      </div>
      <div id="widget-view-root"></div>`;

    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-widget-view]")) {
      button.addEventListener("click", () => {
        this.widgetView = button.dataset.widgetView as WidgetView;
        this.renderWidgets();
        if (this.widgetView === "discover" && this.community.entries.length === 0 && !this.community.error) {
          void this.refreshCommunity();
        }
      });
    }

    const viewRoot = this.element("widget-view-root");
    if (this.widgetView === "installed") {
      this.element("library-edit-overlay").addEventListener("click", () => void window.apexDesktop.setEditMode(true));
      this.element("reload-modules").addEventListener("click", async () => {
        this.modules = await window.apexDesktop.reloadModules();
        this.renderWidgets();
      });
      this.element("open-modules-folder").addEventListener("click", () => void window.apexDesktop.openModulesFolder());
      this.renderInstalledModules(viewRoot);
    } else {
      this.element("refresh-community").addEventListener("click", () => void this.refreshCommunity());
      this.renderCommunity(viewRoot);
    }
  }

  private renderInstalledModules(root: HTMLElement): void {
    root.innerHTML = `
      <section class="widget-summary">
        <div><h2>${escapeHtml(this.t("installedLibrary"))}</h2><p>${escapeHtml(this.t("libraryPurpose"))}</p></div>
      </section>
      <div class="module-toolbar simplified">
        <label class="field search-field"><span>${escapeHtml(this.t("search"))}</span><input id="module-search" type="search" value="${escapeHtml(this.moduleSearch)}" placeholder="${escapeHtml(this.t("searchPlaceholder"))}" /></label>
        <label class="field"><span>${escapeHtml(this.t("sourceType"))}</span><select id="module-origin"><option value="all">${escapeHtml(this.t("all"))}</option><option value="built-in">${escapeHtml(this.t("builtIn"))}</option><option value="community">${escapeHtml(this.t("community"))}</option><option value="local">${escapeHtml(this.t("localModule"))}</option></select></label>
        <span id="module-count" class="count-pill"></span>
      </div>
      <div id="module-grid" class="module-grid compact-grid"></div>`;

    const search = this.element<HTMLInputElement>("module-search");
    search.addEventListener("input", () => {
      this.moduleSearch = search.value.trim().toLocaleLowerCase();
      this.renderModuleCards();
    });
    const origin = this.element<HTMLSelectElement>("module-origin");
    origin.value = this.moduleOrigin;
    origin.addEventListener("change", () => {
      this.moduleOrigin = origin.value;
      this.renderModuleCards();
    });
    this.renderModuleCards();
  }

  private renderModuleCards(): void {
    const grid = document.getElementById("module-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const filtered = this.modules.filter((module) => {
      const haystack = `${module.manifest.name} ${module.manifest.description} ${module.manifest.author}`.toLocaleLowerCase();
      return (!this.moduleSearch || haystack.includes(this.moduleSearch))
        && (this.moduleOrigin === "all" || module.source === this.moduleOrigin);
    });
    const count = document.getElementById("module-count");
    if (count) count.textContent = this.t("shownCount", { shown: filtered.length, total: this.modules.length });

    for (const module of filtered) {
      const card = document.createElement("article");
      card.className = "module-card glance-card";
      const preview = module.previewUrl
        ? `<img src="${module.previewUrl}" alt="${escapeHtml(module.manifest.name)} preview" />`
        : `<span class="module-preview-fallback">${escapeHtml(module.manifest.name.slice(0, 2).toUpperCase())}</span>`;
      card.innerHTML = `
        <div class="module-preview">${preview}<span class="module-origin ${module.source}">${escapeHtml(this.moduleSourceLabel(module.source))}</span></div>
        <div class="module-card-body">
          <div class="module-card-heading"><div><h3>${escapeHtml(module.manifest.name)}</h3><span>${escapeHtml(module.manifest.author)} · v${escapeHtml(module.manifest.version)}</span></div></div>
          <p>${escapeHtml(module.manifest.description)}</p>
        </div>`;
      grid.append(card);
    }
    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state"><b>${escapeHtml(this.t("noMatchingModules"))}</b><span>${escapeHtml(this.t("clearSearchHint"))}</span></div>`;
    }
  }

  private renderCommunity(root: HTMLElement): void {
    const state = this.community;
    root.innerHTML = `
      <section class="widget-summary catalog-summary">
        <div><h2>${escapeHtml(this.t("communityModules"))}</h2><p>${escapeHtml(this.t("communityDescription"))}</p></div>
        <div class="catalog-inline ${state.error ? "error" : ""}"><span class="catalog-dot"></span><div><b>${state.gitAvailable ? escapeHtml(this.t("gitReady")) : escapeHtml(this.t("gitUnavailable"))}</b><small>${state.error ? escapeHtml(state.error) : state.lastUpdatedAt ? escapeHtml(this.t("updatedAt", { date: new Date(state.lastUpdatedAt).toLocaleString(this.locale) })) : escapeHtml(this.t("catalogNeverDownloaded"))}</small></div></div>
      </section>
      <div id="community-grid" class="community-grid compact-grid"></div>`;
    const grid = this.element("community-grid");
    if (state.entries.length === 0) {
      grid.innerHTML = `<div class="empty-state large"><b>${escapeHtml(this.t("noCatalogEntries"))}</b><span>${escapeHtml(this.t("catalogEmptyHint"))}</span></div>`;
      return;
    }
    for (const entry of state.entries) grid.append(this.communityCard(entry));
  }

  private communityCard(entry: CommunityModuleEntry): HTMLElement {
    const card = document.createElement("article");
    card.className = "community-card";
    const busy = this.communityBusy.has(entry.id);
    const action = entry.status === "available" ? this.t("install") : entry.status === "update-available" ? this.t("update") : this.t("installed");
    const stateLabel = entry.status === "update-available"
      ? this.t("updateFrom", { version: entry.installedVersion ?? "?" })
      : entry.status === "installed"
        ? this.t("installedVersion", { version: entry.installedVersion ?? entry.version })
        : this.t("available");
    card.innerHTML = `
      <div class="community-preview">${entry.previewDataUrl ? `<img src="${entry.previewDataUrl}" alt="${escapeHtml(entry.name)} preview" />` : `<span>${escapeHtml(entry.name.slice(0, 2).toUpperCase())}</span>`}</div>
      <div class="community-body"><div class="community-meta"><span>${escapeHtml(entry.author)}</span><span>v${escapeHtml(entry.version)}</span></div><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(entry.description)}</p><footer><span class="install-state ${entry.status}">${escapeHtml(stateLabel)}</span><div class="button-row"><button class="button ${entry.status === "installed" ? "secondary" : "primary"} small install" ${busy || entry.status === "installed" ? "disabled" : ""}>${escapeHtml(busy ? this.t("working") : action)}</button>${entry.status !== "available" ? `<button class="button ghost danger small uninstall" ${busy ? "disabled" : ""}>${escapeHtml(this.t("remove"))}</button>` : ""}</div></footer></div>`;
    card.querySelector<HTMLButtonElement>(".install")?.addEventListener("click", () => void this.installCommunity(entry.id));
    card.querySelector<HTMLButtonElement>(".uninstall")?.addEventListener("click", () => void this.uninstallCommunity(entry.id));
    return card;
  }

  private renderSettings(): void {
    const root = document.getElementById("settings-root");
    if (!root) return;
    const preferences = this.state.preferences;
    const navigation = [
      { id: "general" as const, title: this.t("appearanceAndLanguage"), hint: this.t("languageHint") },
      { id: "overlay" as const, title: this.t("visibility"), hint: this.t("autoHideHint") },
      { id: "integrations" as const, title: this.t("community"), hint: this.t("gitCatalog") },
      { id: "hotkeys" as const, title: this.t("shortcuts"), hint: this.t("hotkeyHint") },
    ];

    root.innerHTML = `
      <div class="settings-workspace">
        <aside class="settings-nav" aria-label="${escapeHtml(this.t("settings"))}">
          ${navigation.map((item) => `<button type="button" class="settings-nav-item${item.id === this.settingsSection ? " active" : ""}" data-settings-section="${item.id}"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.hint)}</small></button>`).join("")}
        </aside>
        <section class="settings-stage panel">
          ${this.renderSettingsSection(preferences)}
        </section>
      </div>`;

    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-settings-section]")) {
      button.addEventListener("click", () => {
        this.cancelHotkeyCapture();
        this.settingsSection = button.dataset.settingsSection as SettingsSection;
        this.renderSettings();
      });
    }

    if (this.settingsSection === "general") {
      const localeSelect = this.element<HTMLSelectElement>("locale-select");
      for (const locale of SUPPORTED_LOCALES) {
        localeSelect.append(option(locale.value, locale.label, locale.value === preferences.locale));
      }
      localeSelect.addEventListener("change", () => void this.savePreferences({ locale: localeSelect.value as AppLocale }));

      const interfaceScale = this.element<HTMLSelectElement>("interface-scale-select");
      interfaceScale.value = String(preferences.interfaceScale);
      interfaceScale.addEventListener("change", () => void this.savePreferences({
        interfaceScale: interfaceScale.value === "auto"
          ? "auto"
          : Number(interfaceScale.value) as InterfaceScale,
      }));

      const hudScale = this.element<HTMLSelectElement>("hud-scale-select");
      hudScale.value = String(preferences.hudScale);
      hudScale.addEventListener("change", () => void this.savePreferences({
        hudScale: hudScale.value === "interface"
          ? "interface"
          : Number(hudScale.value) as HudScale,
      }));
    }

    if (this.settingsSection === "overlay") {
      const autoHide = this.element<HTMLSelectElement>("autohide-select");
      autoHide.value = preferences.overlayAutoHideMode;
      autoHide.addEventListener("change", () => void this.savePreferences({ overlayAutoHideMode: autoHide.value as AppRuntimeState["preferences"]["overlayAutoHideMode"] }));
      this.element("borderless-button").addEventListener("click", async () => {
        try {
          const result = await window.apexDesktop.enableIRacingBorderless();
          this.element("compatibility-status").textContent = result.message;
        } catch (error) {
          this.element("compatibility-status").textContent = error instanceof Error ? error.message : String(error);
        }
      });
      void this.updateDisplayCompatibility();
    }

    if (this.settingsSection === "integrations") {
      this.element("save-community-settings").addEventListener("click", () => void this.savePreferences({
        communityRepositoryUrl: this.element<HTMLInputElement>("community-url").value,
        communityBranch: this.element<HTMLInputElement>("community-branch").value,
        autoCheckCommunityUpdates: this.element<HTMLInputElement>("community-auto").checked,
      }));
    }

    if (this.settingsSection === "hotkeys") {
      for (const button of root.querySelectorAll<HTMLButtonElement>("[data-hotkey-action]")) {
        button.addEventListener("click", () => void this.beginHotkeyCapture(button.dataset.hotkeyAction as HotkeyAction));
      }
    }
  }

  private renderSettingsSection(preferences: AppRuntimeState["preferences"]): string {
    if (this.settingsSection === "general") {
      const percentOptions = [1, 1.25, 1.5, 1.75, 2]
        .map((scale) => `<option value="${scale}">${Math.round(scale * 100)}%</option>`)
        .join("");
      return `<header class="settings-stage-header"><span>${escapeHtml(this.t("appearanceAndLanguage"))}</span><h2>${escapeHtml(this.t("appearanceAndLanguage"))}</h2><p>${escapeHtml(this.t("interfaceScaleHint"))}</p></header><div class="settings-form">
        <label class="setting-row prominent"><span><b>${escapeHtml(this.t("language"))}</b><small>${escapeHtml(this.t("languageHint"))}</small></span><select id="locale-select"></select></label>
        <label class="setting-row prominent"><span><b>${escapeHtml(this.t("interfaceScale"))}</b><small>${escapeHtml(this.t("interfaceScaleHint"))}</small></span><select id="interface-scale-select"><option value="auto">${escapeHtml(this.t("automaticScale"))}</option>${percentOptions}</select></label>
        <label class="setting-row prominent"><span><b>${escapeHtml(this.t("hudScale"))}</b><small>${escapeHtml(this.t("hudScaleHint"))}</small></span><select id="hud-scale-select"><option value="interface">${escapeHtml(this.t("sameAsInterface"))}</option><option value="0.75">75%</option>${percentOptions}</select></label>
      </div>`;
    }
    if (this.settingsSection === "overlay") {
      return `<header class="settings-stage-header"><span>${escapeHtml(this.t("visibility"))}</span><h2>${escapeHtml(this.t("autoHideMode"))}</h2><p>${escapeHtml(this.t("autoHideHint"))}</p></header><div class="settings-form"><label class="setting-row prominent"><span><b>${escapeHtml(this.t("autoHideMode"))}</b><small>${escapeHtml(this.t("autoHideHint"))}</small></span><select id="autohide-select"><option value="not-foreground">${escapeHtml(this.t("hideNotForeground"))}</option><option value="minimized">${escapeHtml(this.t("hideMinimized"))}</option><option value="never">${escapeHtml(this.t("neverHide"))}</option></select></label><div class="setting-row action-row"><span><b>${escapeHtml(this.t("fullscreenCompatibility"))}</b><small id="compatibility-status">${escapeHtml(this.t("inspectingConfiguration"))}</small></span><button id="borderless-button" class="button secondary">${escapeHtml(this.t("configureBorderless"))}</button></div></div>`;
    }
    if (this.settingsSection === "integrations") {
      return `<header class="settings-stage-header"><span>${escapeHtml(this.t("community"))}</span><h2>${escapeHtml(this.t("gitCatalog"))}</h2><p>${escapeHtml(this.t("gitUsageNote"))}</p></header><div class="settings-form integration-form"><label class="field"><span>${escapeHtml(this.t("repositoryUrl"))}</span><input id="community-url" value="${escapeHtml(preferences.communityRepositoryUrl)}" /></label><label class="field"><span>${escapeHtml(this.t("branch"))}</span><input id="community-branch" value="${escapeHtml(preferences.communityBranch)}" /></label><label class="check-row integration-check"><input id="community-auto" type="checkbox" ${preferences.autoCheckCommunityUpdates ? "checked" : ""}/><span><b>${escapeHtml(this.t("automaticUpdates"))}</b><small>${escapeHtml(this.t("automaticUpdatesHint"))}</small></span></label><button id="save-community-settings" class="button primary integration-save">${escapeHtml(this.t("saveCatalog"))}</button></div>`;
    }
    return `<header class="settings-stage-header"><span>${escapeHtml(this.t("shortcuts"))}</span><h2>${escapeHtml(this.t("globalHotkeys"))}</h2><p>${escapeHtml(this.t("hotkeyHint"))}</p></header><div class="shortcut-list">
      ${this.hotkeyRow("editLayout", this.t("editLayout"), preferences.hotkeys.editLayout)}
      ${this.hotkeyRow("toggleOverlay", this.t("toggleOverlay"), preferences.hotkeys.toggleOverlay)}
      ${this.hotkeyRow("openControlCenter", this.t("openControlCenter"), preferences.hotkeys.openControlCenter)}
    </div><p id="hotkey-message" class="settings-message" aria-live="polite"></p>`;
  }

  private async switchGroup(groupId: string): Promise<void> {
    commitLayoutForScenario(this.workspace, this.selectedScenario, this.currentLayout);
    this.workspace.activeGroupId = groupId;
    this.refreshCurrentLayout();
    await this.persistWorkspace();
  }

  private async switchScenario(scenario: LayoutScenario): Promise<void> {
    commitLayoutForScenario(this.workspace, this.selectedScenario, this.currentLayout);
    this.selectedScenario = scenario;
    this.profilePinned = true;
    this.refreshCurrentLayout();
    this.renderLayouts();
    this.renderWidgets();
    this.renderOverview();
  }

  private async createGroup(): Promise<void> {
    const name = window.prompt(this.t("layoutSetNamePrompt"), this.t("newLayoutSet"));
    if (!name) return;
    commitLayoutForScenario(this.workspace, this.selectedScenario, this.currentLayout);
    const created = createLayoutGroup(name, this.currentLayout);
    this.workspace.groups.push(created);
    this.workspace.activeGroupId = created.id;
    this.refreshCurrentLayout();
    await this.persistWorkspace();
  }

  private async duplicateGroup(): Promise<void> {
    commitLayoutForScenario(this.workspace, this.selectedScenario, this.currentLayout);
    const source = activeLayoutGroup(this.workspace);
    const copy = duplicateLayoutGroup(source);
    this.workspace.groups.push(copy);
    this.workspace.activeGroupId = copy.id;
    this.refreshCurrentLayout();
    await this.persistWorkspace();
  }

  private async renameGroup(): Promise<void> {
    const group = activeLayoutGroup(this.workspace);
    const name = window.prompt(this.t("renameLayoutSetPrompt"), group.name);
    if (!name?.trim()) return;
    group.name = name.trim().slice(0, 60);
    await this.saveWorkspace();
  }

  private async deleteGroup(): Promise<void> {
    if (this.workspace.groups.length <= 1) return;
    const group = activeLayoutGroup(this.workspace);
    if (!window.confirm(this.t("deleteLayoutSetConfirm", { name: group.name }))) return;
    this.workspace.groups = this.workspace.groups.filter((item) => item.id !== group.id);
    this.workspace.activeGroupId = this.workspace.groups[0]!.id;
    this.refreshCurrentLayout();
    await this.persistWorkspace();
  }

  private async resetToBase(): Promise<void> {
    if (this.selectedScenario === "default") return;
    if (!window.confirm(this.t("resetLayoutConfirm", { layout: this.scenario(this.selectedScenario) }))) return;
    this.currentLayout = resetCurrentProfileToBase(activeLayoutGroup(this.workspace), this.selectedScenario);
    await this.persistWorkspace();
  }

  private fillTargetSelectors(): void {
    const sourceGroup = this.element<HTMLSelectElement>("copy-source-group");
    const targetGroup = this.element<HTMLSelectElement>("copy-target-group");
    const sourceProfile = this.element<HTMLSelectElement>("copy-source-profile");
    const targetProfile = this.element<HTMLSelectElement>("copy-target-profile");
    const active = activeLayoutGroup(this.workspace);
    for (const group of this.workspace.groups) {
      sourceGroup.append(option(group.id, group.name, group.id === active.id));
      targetGroup.append(option(group.id, group.name, group.id === active.id));
    }
    for (const scenario of LAYOUT_SCENARIOS) {
      sourceProfile.append(option(scenario, this.scenario(scenario), scenario === this.selectedScenario));
      targetProfile.append(option(scenario, this.scenario(scenario), scenario === this.selectedScenario));
    }
  }

  private async copyLayout(): Promise<void> {
    commitLayoutForScenario(this.workspace, this.selectedScenario, this.currentLayout);
    const source: LayoutTarget = {
      groupId: this.element<HTMLSelectElement>("copy-source-group").value,
      scenario: this.element<HTMLSelectElement>("copy-source-profile").value as LayoutScenario,
    };
    const target: LayoutTarget = {
      groupId: this.element<HTMLSelectElement>("copy-target-group").value,
      scenario: this.element<HTMLSelectElement>("copy-target-profile").value as LayoutScenario,
    };
    const sourceGroup = this.workspace.groups.find((group) => group.id === source.groupId);
    const targetGroup = this.workspace.groups.find((group) => group.id === target.groupId);
    if (!sourceGroup || !targetGroup) return;
    const sourceName = `${sourceGroup.name} · ${this.scenario(source.scenario)}`;
    const targetName = `${targetGroup.name} · ${this.scenario(target.scenario)}`;
    if (!window.confirm(this.t("copyConfirm", { source: sourceName, target: targetName }))) return;
    copyLayoutBetweenTargets(this.workspace, source, target);
    if (target.groupId === this.workspace.activeGroupId && target.scenario === this.selectedScenario) {
      this.refreshCurrentLayout();
    }
    await this.persistWorkspace();
  }

  private async saveWorkspace(): Promise<void> {
    commitLayoutForScenario(this.workspace, this.selectedScenario, this.currentLayout);
    await this.persistWorkspace();
  }

  private async persistWorkspace(): Promise<void> {
    this.workspace = await window.apexDesktop.saveLayoutWorkspace(this.workspace);
    this.refreshCurrentLayout();
    this.renderLayouts();
    this.renderWidgets();
    this.renderOverview();
  }

  private refreshCurrentLayout(): void {
    this.currentLayout = layoutForScenario(this.workspace, this.selectedScenario);
  }

  private async refreshCommunity(): Promise<void> {
    const button = document.getElementById("refresh-community") as HTMLButtonElement | null;
    if (button) {
      button.disabled = true;
      button.textContent = this.t("refreshing");
    }
    this.community = await window.apexDesktop.refreshCommunityCatalog();
    this.renderWidgets();
  }

  private async installCommunity(id: string): Promise<void> {
    this.communityBusy.add(id);
    this.renderWidgets();
    try {
      this.community = await window.apexDesktop.installCommunityModule(id);
      this.modules = await window.apexDesktop.listModules();
    } finally {
      this.communityBusy.delete(id);
      this.renderWidgets();
    }
  }

  private async uninstallCommunity(id: string): Promise<void> {
    if (!window.confirm(this.t("removeCommunityConfirm"))) return;
    this.communityBusy.add(id);
    this.renderWidgets();
    try {
      this.community = await window.apexDesktop.uninstallCommunityModule(id);
      this.modules = await window.apexDesktop.listModules();
    } finally {
      this.communityBusy.delete(id);
      this.renderWidgets();
    }
  }

  private async savePreferences(changes: Partial<AppRuntimeState["preferences"]>): Promise<boolean> {
    try {
      this.state.preferences = await window.apexDesktop.savePreferences({
        ...this.state.preferences,
        ...changes,
        schemaVersion: 5,
      });
      this.renderSettings();
      return true;
    } catch (error) {
      console.error("Could not save preferences", error);
      return false;
    }
  }

  private hotkeyRow(action: HotkeyAction, label: string, accelerator: string): string {
    return `<div class="shortcut-row"><span><b>${escapeHtml(label)}</b><small>${escapeHtml(this.formatHotkey(accelerator))}</small></span><button type="button" class="hotkey-button" data-hotkey-action="${action}"><kbd>${escapeHtml(this.formatHotkey(accelerator))}</kbd><em>${escapeHtml(this.t("changeHotkey"))}</em></button></div>`;
  }

  private async beginHotkeyCapture(action: HotkeyAction): Promise<void> {
    window.removeEventListener("keydown", this.captureHotkey, true);
    const wasCapturing = this.hotkeyCapture !== undefined;
    this.hotkeyCapture = undefined;
    for (const candidate of document.querySelectorAll<HTMLElement>(".hotkey-button.capturing")) {
      candidate.classList.remove("capturing");
    }
    if (wasCapturing) await window.apexDesktop.endHotkeyCapture();

    try {
      await window.apexDesktop.beginHotkeyCapture();
    } catch (error) {
      console.error("Could not begin hotkey capture", error);
      const message = document.getElementById("hotkey-message");
      if (message) message.textContent = this.t("hotkeySaveFailed");
      return;
    }

    this.hotkeyCapture = action;
    const button = document.querySelector<HTMLButtonElement>(`[data-hotkey-action="${action}"]`);
    if (button) {
      button.classList.add("capturing");
      button.focus();
      button.querySelector("kbd")!.textContent = this.t("pressShortcut");
    }
    const message = document.getElementById("hotkey-message");
    if (message) message.textContent = "";
    window.addEventListener("keydown", this.captureHotkey, true);
  }

  private cancelHotkeyCapture(): void {
    window.removeEventListener("keydown", this.captureHotkey, true);
    const wasCapturing = this.hotkeyCapture !== undefined;
    this.hotkeyCapture = undefined;
    for (const button of document.querySelectorAll<HTMLElement>(".hotkey-button.capturing")) {
      button.classList.remove("capturing");
    }
    if (wasCapturing) void window.apexDesktop.endHotkeyCapture();
  }

  private readonly captureHotkey = (event: KeyboardEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (["Control", "Meta", "Alt", "Shift"].includes(event.key)) return;

    window.removeEventListener("keydown", this.captureHotkey, true);
    const action = this.hotkeyCapture;
    this.hotkeyCapture = undefined;
    if (!action || event.key === "Escape") {
      void window.apexDesktop.endHotkeyCapture();
      this.renderSettings();
      return;
    }

    const accelerator = this.acceleratorFromEvent(event);
    if (!accelerator) {
      void window.apexDesktop.endHotkeyCapture();
      this.renderSettings();
      const message = document.getElementById("hotkey-message");
      if (message) message.textContent = this.t("hotkeyInvalid");
      return;
    }

    const duplicate = (Object.entries(this.state.preferences.hotkeys) as Array<[HotkeyAction, string]>)
      .some(([candidate, value]) => candidate !== action && value.toLowerCase() === accelerator.toLowerCase());
    if (duplicate) {
      void window.apexDesktop.endHotkeyCapture();
      this.renderSettings();
      const message = document.getElementById("hotkey-message");
      if (message) message.textContent = this.t("hotkeyConflict");
      return;
    }
    void this.commitHotkey(action, accelerator);
  };

  private async commitHotkey(action: HotkeyAction, accelerator: string): Promise<void> {
    const saved = await this.savePreferences({
      hotkeys: { ...this.state.preferences.hotkeys, [action]: accelerator },
    });
    const message = document.getElementById("hotkey-message");
    if (!saved) {
      await window.apexDesktop.endHotkeyCapture();
      if (message) message.textContent = this.t("hotkeySaveFailed");
      return;
    }
    if (message) {
      message.classList.add("success");
      message.textContent = `✓ ${this.formatHotkey(accelerator)}`;
    }
  }

  private acceleratorFromEvent(event: KeyboardEvent): string | undefined {
    const modifiers: string[] = [];
    if (event.ctrlKey || event.metaKey) modifiers.push("CommandOrControl");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");

    const codeAliases: Record<string, string> = {
      Space: "Space", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
      Escape: "Esc", Delete: "Delete", Backspace: "Backspace", Enter: "Enter", Tab: "Tab",
      PageUp: "PageUp", PageDown: "PageDown", Home: "Home", End: "End", Insert: "Insert",
    };
    let key = codeAliases[event.code] ?? codeAliases[event.key];
    if (!key && event.code.startsWith("Key")) key = event.code.slice(3);
    if (!key && event.code.startsWith("Digit")) key = event.code.slice(5);
    if (!key && /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)) key = event.code;
    if (!key) {
      const raw = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      if (/^[A-Z0-9]$/.test(raw)) key = raw;
    }
    if (!key) return undefined;
    if (modifiers.length === 0 && !/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) return undefined;
    return [...modifiers, key].join("+");
  }

  private formatHotkey(accelerator: string): string {
    return accelerator
      .replace("CommandOrControl", "Ctrl")
      .split("+")
      .join(" + ");
  }

  private onTelemetry(frame: TelemetrySnapshot): void {
    this.latestFrame = frame;
    const scenario = scenarioFromTelemetry(frame);
    if (!this.profilePinned && scenario !== this.selectedScenario) {
      this.selectedScenario = scenario;
      this.refreshCurrentLayout();
      this.renderLayouts();
      this.renderWidgets();
      this.renderOverview();
    }
    this.renderTelemetry();
  }

  private renderTelemetry(): void {
    const frame = this.latestFrame;
    const source = frame?.source ?? "none";
    const connected = this.telemetryStatus === "connected";
    const title = source === "iracing"
      ? this.t("liveIRacingSession")
      : source === "mock"
        ? this.t("visualDevelopmentMode")
        : connected
          ? this.t("waitingForIRacing")
          : this.t("telemetryReconnecting");
    setText("source-title", title);
    setText("source-description", source === "iracing"
      ? this.t("sharedMemoryConnected")
      : source === "mock"
        ? this.t("syntheticTelemetry")
        : this.t("desktopReady"));
    setText("track-name", frame?.session.trackName ?? "—");
    setText("session-type", frame?.session.sessionType ?? "—");
    setText("session-time", frame ? frame.session.hasTimeLimit ? formatDuration(frame.session.timeRemainingSeconds) : "OPEN" : "—");
    setText("field-size", frame ? String(frame.standings.entries.length) : "—");
    setText("sidebar-source", title);
    setText("sidebar-track", frame?.session.trackName ?? this.t("noActiveSession"));
    const badge = document.getElementById("source-badge");
    if (badge) {
      badge.textContent = source === "iracing" ? this.t("live").toUpperCase() : source === "mock" ? this.t("demo").toUpperCase() : this.t("waiting").toUpperCase();
      badge.className = `status-badge ${source}`;
    }
    const dotState = source === "iracing" ? "live" : source === "mock" ? "mock" : "";
    for (const id of ["sidebar-source-dot", "home-source-dot"]) {
      const dot = document.getElementById(id);
      if (dot) dot.className = id === "home-source-dot" ? `home-live-dot ${dotState}`.trim() : dotState;
    }
  }

  private renderActions(): void {
    const edit = document.getElementById("edit-button") as HTMLButtonElement | null;
    const overlay = document.getElementById("overlay-button") as HTMLButtonElement | null;
    if (edit) edit.textContent = this.state.editMode ? this.t("finishEditing") : this.t("editOverlay");
    if (overlay) {
      overlay.textContent = !this.state.overlayVisible
        ? this.t("enableOverlay")
        : this.state.editMode || this.state.sessionActive
          ? this.t("hideOverlay")
          : this.t("overlayArmed");
    }
  }

  private async updateDisplayCompatibility(): Promise<void> {
    const status = document.getElementById("compatibility-status");
    if (!status) return;
    try {
      status.textContent = (await window.apexDesktop.getIRacingDisplayState()).message;
    } catch {
      status.textContent = this.t("couldNotInspectDisplay");
    }
  }


  private moduleSourceLabel(source: DiscoveredModule["source"]): string {
    if (source === "community") return this.t("community");
    if (source === "local") return this.t("localModule");
    return this.t("builtIn");
  }

  private navIcon(tab: ControlTab): string {
    const paths: Record<ControlTab, string> = {
      overview: '<path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z"/>',
      layouts: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/>',
      widgets: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M17 14v6M14 17h6"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1H9.6a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4V9.6A1.7 1.7 0 0 0 4 9.2a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1h4a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.28.35.48.75.6 1 .1.36.46.6.84.6h.16v4h-.16a.9.9 0 0 0-.84.6c-.12.25-.32.65-.6 1z"/>',
    };
    return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[tab]}</svg>`;
  }

  private tabButton(tab: ControlTab, label: TranslationKey): string {
    return `<button class="tab-button" data-tab="${tab}">${this.navIcon(tab)}<b>${escapeHtml(this.t(label))}</b></button>`;
  }

  private element<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing element #${id}`);
    return element as T;
  }
}

function option(value: string, label: string, selected: boolean): HTMLOptionElement {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  item.selected = selected;
  return item;
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

void new ControlCenterApplication().start();
