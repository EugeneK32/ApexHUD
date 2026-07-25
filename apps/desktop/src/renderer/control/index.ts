import {
  LAYOUT_SCENARIOS,
  type AppLocale,
  type CommunityCatalogState,
  type CommunityModuleEntry,
  type DiscoveredModule,
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
  private latestFrame: TelemetrySnapshot | undefined;
  private telemetryStatus: TelemetryStatus = "connecting";
  private telemetry!: TelemetryClient;
  private moduleSearch = "";
  private moduleOrigin = "all";
  private communityBusy = new Set<string>();

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
      <div class="home-grid">
        <article class="home-session panel">
          <div class="home-status-line"><span id="home-source-dot" class="home-live-dot"></span><b id="source-title">${escapeHtml(this.t("waitingForIRacing"))}</b><span id="source-badge" class="status-badge">${escapeHtml(this.t("waiting").toUpperCase())}</span></div>
          <p id="source-description">${escapeHtml(this.t("telemetryReady"))}</p>
          <div class="home-session-facts">
            <div><span>${escapeHtml(this.t("track"))}</span><b id="track-name">—</b></div>
            <div><span>${escapeHtml(this.t("session"))}</span><b id="session-type">—</b></div>
            <div><span>${escapeHtml(this.t("remaining"))}</span><b id="session-time">—</b></div>
          </div>
          <button id="home-edit" class="button primary home-primary">${escapeHtml(this.t("editOverlay"))}</button>
        </article>
        <article class="home-hud panel">
          <span>${escapeHtml(this.t("activeLayout"))}</span>
          <h2>${escapeHtml(group.name)}</h2>
          <p>${escapeHtml(this.scenario(this.selectedScenario))} · ${escapeHtml(this.t("placedCount", { count: enabled }))}</p>
          <div class="home-links">
            <button id="overview-layouts" class="home-link"><b>${escapeHtml(this.t("layouts"))}</b><span>${escapeHtml(this.t("configureLayouts"))}</span></button>
            <button id="overview-widgets" class="home-link"><b>${escapeHtml(this.t("moduleLibrary"))}</b><span>${escapeHtml(this.t("browseInstalled"))}</span></button>
          </div>
        </article>
      </div>`;
    this.element("home-edit").addEventListener("click", () => void window.apexDesktop.setEditMode(true));
    this.element("overview-layouts").addEventListener("click", () => this.openTab("layouts"));
    this.element("overview-widgets").addEventListener("click", () => { this.widgetView = "installed"; this.openTab("widgets"); this.renderWidgets(); });
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
    root.innerHTML = `
      <div class="settings-grid">
        <article class="panel settings-card"><span class="panel-eyebrow">${escapeHtml(this.t("appearanceAndLanguage"))}</span><h2>${escapeHtml(this.t("language"))}</h2><label class="setting-row"><span><b>${escapeHtml(this.t("language"))}</b><small>${escapeHtml(this.t("languageHint"))}</small></span><select id="locale-select"></select></label></article>
        <article class="panel settings-card"><span class="panel-eyebrow">${escapeHtml(this.t("visibility"))}</span><h2>${escapeHtml(this.t("visibility"))}</h2><label class="setting-row"><span><b>${escapeHtml(this.t("autoHideMode"))}</b><small>${escapeHtml(this.t("autoHideHint"))}</small></span><select id="autohide-select"><option value="not-foreground">${escapeHtml(this.t("hideNotForeground"))}</option><option value="minimized">${escapeHtml(this.t("hideMinimized"))}</option><option value="never">${escapeHtml(this.t("neverHide"))}</option></select></label></article>
        <details class="panel settings-advanced"><summary><span><b>${escapeHtml(this.t("community"))}</b><small>${escapeHtml(this.t("gitCatalog"))}</small></span><i>⌄</i></summary><div class="settings-advanced-body"><label class="field"><span>${escapeHtml(this.t("repositoryUrl"))}</span><input id="community-url" value="${escapeHtml(preferences.communityRepositoryUrl)}" /></label><label class="field"><span>${escapeHtml(this.t("branch"))}</span><input id="community-branch" value="${escapeHtml(preferences.communityBranch)}" /></label><label class="check-row"><input id="community-auto" type="checkbox" ${preferences.autoCheckCommunityUpdates ? "checked" : ""}/><span><b>${escapeHtml(this.t("automaticUpdates"))}</b><small>${escapeHtml(this.t("automaticUpdatesHint"))}</small></span></label><button id="save-community-settings" class="button secondary">${escapeHtml(this.t("saveCatalog"))}</button><p class="settings-note">${escapeHtml(this.t("gitUsageNote"))}</p></div></details>
        <article class="panel settings-card"><span class="panel-eyebrow">${escapeHtml(this.t("iracingWindow"))}</span><h2>${escapeHtml(this.t("fullscreenCompatibility"))}</h2><p id="compatibility-status" class="settings-note">${escapeHtml(this.t("inspectingConfiguration"))}</p><button id="borderless-button" class="button secondary">${escapeHtml(this.t("configureBorderless"))}</button></article>
        <article class="panel settings-card"><span class="panel-eyebrow">${escapeHtml(this.t("shortcuts"))}</span><h2>${escapeHtml(this.t("globalHotkeys"))}</h2><div class="shortcut-list"><div><kbd>Ctrl Shift F10</kbd><span>${escapeHtml(this.t("editLayout"))}</span></div><div><kbd>Ctrl Shift F11</kbd><span>${escapeHtml(this.t("toggleOverlay"))}</span></div><div><kbd>Ctrl Shift F12</kbd><span>${escapeHtml(this.t("openControlCenter"))}</span></div></div></article>
      </div>`;

    const localeSelect = this.element<HTMLSelectElement>("locale-select");
    for (const locale of SUPPORTED_LOCALES) {
      localeSelect.append(option(locale.value, locale.label, locale.value === preferences.locale));
    }
    localeSelect.addEventListener("change", () => void this.savePreferences({ locale: localeSelect.value as AppLocale }));

    const autoHide = this.element<HTMLSelectElement>("autohide-select");
    autoHide.value = preferences.overlayAutoHideMode;
    autoHide.addEventListener("change", () => void this.savePreferences({ overlayAutoHideMode: autoHide.value as AppRuntimeState["preferences"]["overlayAutoHideMode"] }));
    this.element("save-community-settings").addEventListener("click", () => void this.savePreferences({
      communityRepositoryUrl: this.element<HTMLInputElement>("community-url").value,
      communityBranch: this.element<HTMLInputElement>("community-branch").value,
      autoCheckCommunityUpdates: this.element<HTMLInputElement>("community-auto").checked,
    }));
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

  private async savePreferences(changes: Partial<AppRuntimeState["preferences"]>): Promise<void> {
    this.state.preferences = await window.apexDesktop.savePreferences({
      ...this.state.preferences,
      ...changes,
      schemaVersion: 3,
    });
    this.renderSettings();
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

  private tabButton(tab: ControlTab, label: TranslationKey): string {
    return `<button class="tab-button" data-tab="${tab}"><b>${escapeHtml(this.t(label))}</b></button>`;
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
