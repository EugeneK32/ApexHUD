import {
  defaultsFromManifest,
  LAYOUT_SCENARIOS,
  PROTOCOL_VERSION,
  sanitizeBounds,
  type AppPreferences,
  type DiscoveredModule,
  type HostToModuleMessage,
  type LayoutDocument,
  type LayoutScenario,
  type LayoutWorkspace,
  type ModuleInstance,
  type ModuleManifest,
  type ModuleSettingField,
  type SettingValue,
  type TelemetrySnapshot,
} from "@apexhud/protocol";
import { escapeHtml } from "../shared/format";
import { TelemetryClient, type TelemetryStatus } from "../shared/telemetryClient";
import { scenarioFromTelemetry } from "../shared/layoutScenario";
import { scenarioLabel, translate, type TranslationKey } from "../shared/i18n";
import {
  activeLayoutGroup,
  commitLayoutForScenario,
  layoutForScenario,
  resetCurrentProfileToBase,
} from "../shared/layoutWorkspace";
import { SerializedLayoutWriter } from "./layoutSaveQueue";
import { shouldHideModuleAtRuntime } from "./runtimeVisibility";
import { NativeRadarRenderer } from "./nativeRadar";
import { isRaceOverlayActive } from "./sessionVisibility";
import "./overlay.css";

interface FrameRecord {
  element: HTMLDivElement;
  iframe: HTMLIFrameElement | undefined;
  nativeRadar: NativeRadarRenderer | undefined;
  instance: ModuleInstance;
  module: DiscoveredModule;
}

interface PointerAction {
  kind: "drag" | "resize";
  instanceId: string;
  startX: number;
  startY: number;
  initial: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

class OverlayApplication {
  private modules: DiscoveredModule[] = [];
  private workspace!: LayoutWorkspace;
  private layout!: LayoutDocument;
  private automaticScenario: LayoutScenario = "default";
  private editorScenario: LayoutScenario = "default";
  private preferences: AppPreferences = {
    schemaVersion: 3,
    locale: "en",
    overlayAutoHideMode: "not-foreground",
    communityRepositoryUrl: "https://github.com/EugeneK32/apexhud-community-modules.git",
    communityBranch: "main",
    autoCheckCommunityUpdates: true,
  };
  private editMode = false;
  private sessionActive = false;
  private latestFrame: TelemetrySnapshot | undefined;
  private frames = new Map<string, FrameRecord>();
  private selectedInstanceId: string | undefined;
  private pointerAction: PointerAction | undefined;
  private telemetryStatus: TelemetryStatus = "connecting";
  private telemetry!: TelemetryClient;
  private saveTimer: number | undefined;
  private workspaceSignature = "";
  private layoutWriter!: SerializedLayoutWriter<LayoutWorkspace>;

  private readonly surface = document.createElement("div");
  private readonly toolbar = document.createElement("div");
  private readonly inspector = document.createElement("aside");
  private readonly statusPill = document.createElement("div");
  private readonly addMenu = document.createElement("div");

  private t(key: TranslationKey, vars?: Record<string, string | number>): string {
    return translate(this.preferences.locale, key, vars);
  }

  private scenario(scenario: LayoutScenario): string {
    return scenarioLabel(this.preferences.locale, scenario);
  }

  public async start(): Promise<void> {
    const app = document.querySelector<HTMLDivElement>("#app");
    if (!app) throw new Error("Overlay root is missing");

    app.innerHTML = "";
    app.append(this.surface, this.toolbar, this.inspector, this.addMenu);

    this.surface.className = "overlay-surface";
    this.toolbar.className = "editor-toolbar";
    this.inspector.className = "editor-inspector";
    this.statusPill.className = "telemetry-pill";
    this.addMenu.className = "add-menu";

    const [state, modules, workspace] = await Promise.all([
      window.apexDesktop.getState(),
      window.apexDesktop.listModules(),
      window.apexDesktop.getLayoutWorkspace(),
    ]);

    this.editMode = state.editMode;
    this.sessionActive = state.sessionActive;
    this.preferences = state.preferences;
    document.documentElement.lang = this.preferences.locale;
    this.modules = modules;
    this.workspace = workspace;
    this.automaticScenario = scenarioFromTelemetry(this.latestFrame);
    this.editorScenario = this.automaticScenario;
    this.refreshActiveLayout();
    this.workspaceSignature = JSON.stringify(workspace);
    this.layoutWriter = new SerializedLayoutWriter(
      () => structuredClone(this.workspace),
      (snapshot) => window.apexDesktop.saveLayoutWorkspace(snapshot),
      (snapshot) => JSON.stringify(snapshot),
      (saved) => {
        this.workspaceSignature = JSON.stringify(saved);
      },
    );

    this.renderToolbar();
    this.renderModules();
    this.applyEditMode();

    this.telemetry = new TelemetryClient(
      state.telemetryUrl,
      (frame) => this.onTelemetry(frame),
      (status) => this.onTelemetryStatus(status),
    );
    this.telemetry.start();

    window.apexDesktop.onEditModeChanged((enabled) => {
      const wasEditing = this.editMode;
      if (wasEditing && !enabled) {
        this.commitCurrentLayout();
        this.layoutWriter.markDirty();
        void this.flushLayoutSaves();
      }
      this.editMode = enabled;
      if (enabled) {
        this.editorScenario = this.automaticScenario;
      }
      this.refreshActiveLayout();
      this.selectedInstanceId = undefined;
      this.renderModules();
      this.renderToolbar();
      this.renderInspector();
      this.applyEditMode();
    });

    window.apexDesktop.onLayoutWorkspaceChanged((next) => {
      const signature = JSON.stringify(next);
      if (signature === this.workspaceSignature) return;

      const currentSignature = JSON.stringify(this.workspace);
      if (signature === currentSignature) {
        this.workspaceSignature = signature;
        this.layoutWriter.acknowledgeCurrent();
        return;
      }

      if (
        this.layoutWriter.isPendingSignature(signature) ||
        this.layoutWriter.isSaving ||
        this.layoutWriter.hasPendingChanges
      ) {
        return;
      }

      this.workspace = next;
      this.workspaceSignature = signature;
      this.refreshActiveLayout();
      this.selectedInstanceId = undefined;
      this.renderModules();
      this.renderToolbar();
      this.renderInspector();
    });

    window.apexDesktop.onPreferencesChanged((next) => {
      const languageChanged = next.locale !== this.preferences.locale;
      this.preferences = next;
      document.documentElement.lang = next.locale;
      if (languageChanged) {
        this.renderToolbar();
        this.renderInspector();
        this.renderAddMenu();
      }
      if (this.latestFrame) {
        this.updateSessionActive(
          isRaceOverlayActive(this.latestFrame, this.preferences.overlayAutoHideMode),
        );
      }
    });

    window.apexDesktop.onModulesChanged((next) => {
      this.modules = next;
      this.renderModules();
      this.renderToolbar();
    });

    window.addEventListener("resize", () => this.positionFrames());
    window.addEventListener("pointermove", (event) => this.onPointerMove(event));
    window.addEventListener("pointerup", () => this.finishPointerAction());
    window.addEventListener("message", (event) => this.onModuleMessage(event));
    window.addEventListener("keydown", (event) => this.onKeyDown(event));
    window.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".editor-popover-root")) return;
      this.closeEditorPopovers();
    });
  }

  private renderToolbar(): void {
    this.toolbar.innerHTML = "";

    const brand = document.createElement("div");
    brand.className = "toolbar-brand";
    brand.innerHTML = `<span class="brand-mark">A</span><span><b>APEX</b>HUD</span>`;

    const groupDropdown = this.editorDropdown(
      this.t("set"),
      this.workspace.activeGroupId,
      this.workspace.groups.map((group) => ({ value: group.id, label: group.name })),
      (groupId) => {
        this.commitCurrentLayout();
        this.workspace.activeGroupId = groupId;
        this.refreshActiveLayout();
        this.selectedInstanceId = undefined;
        this.renderModules();
        this.renderInspector();
        this.queueSave();
        this.renderToolbar();
      },
    );

    const profileDropdown = this.editorDropdown(
      this.t("mode"),
      this.editorScenario,
      LAYOUT_SCENARIOS.map((scenario) => ({
        value: scenario,
        label: this.scenario(scenario),
        description: scenario === "default" ? this.t("baseSource") : this.t("inheritedFromBase"),
      })),
      (scenario) => {
        this.commitCurrentLayout();
        this.editorScenario = scenario as LayoutScenario;
        this.refreshActiveLayout();
        this.selectedInstanceId = undefined;
        this.renderModules();
        this.renderInspector();
        this.renderToolbar();
      },
      "scenario",
    );

    const addButton = this.button(`＋ ${this.t("addModule")}`, () => this.toggleAddMenu());
    const centerButton = this.button(this.t("controlCenter"), () => {
      void window.apexDesktop.showControlCenter();
    });
    centerButton.classList.add("subtle");

    const resetToBaseButton = this.button(this.t("resetToBase"), () => {
      if (this.editorScenario === "default") return;
      const label = this.scenario(this.editorScenario);
      if (!window.confirm(this.t("resetLayoutConfirm", { layout: label }))) return;
      const group = activeLayoutGroup(this.workspace);
      resetCurrentProfileToBase(group, this.editorScenario);
      this.refreshActiveLayout();
      this.selectedInstanceId = undefined;
      this.renderModules();
      this.renderInspector();
      this.queueSave();
      this.renderToolbar();
    });
    resetToBaseButton.disabled = this.editorScenario === "default";
    resetToBaseButton.classList.add("subtle");

    const doneButton = this.button(this.t("done"), () => {
      void (async () => {
        await this.saveLayout();
        await window.apexDesktop.setEditMode(false);
      })();
    });
    doneButton.classList.add("primary");

    const spacer = document.createElement("div");
    spacer.className = "toolbar-spacer";

    this.toolbar.append(
      brand,
      groupDropdown,
      profileDropdown,
      addButton,
      resetToBaseButton,
      centerButton,
      spacer,
      this.statusPill,
      doneButton,
    );
    this.updateStatusPill();
    this.renderAddMenu();
  }

  private refreshActiveLayout(): void {
    const scenario = this.editMode ? this.editorScenario : this.automaticScenario;
    this.layout = layoutForScenario(this.workspace, scenario);
  }

  private renderAddMenu(): void {
    this.addMenu.innerHTML = "";
    const title = document.createElement("div");
    title.className = "add-menu-title";
    title.textContent = this.t("addWidgetTitle");
    this.addMenu.append(title);

    for (const module of this.modules) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "add-menu-item";
      item.innerHTML = `
        <span class="add-icon">${escapeHtml(module.manifest.name.slice(0, 1))}</span>
        <span>
          <b>${escapeHtml(module.manifest.name)}</b>
          <small>${escapeHtml(module.manifest.description)}</small>
        </span>
      `;
      item.addEventListener("click", () => {
        this.addModule(module);
        this.addMenu.classList.remove("open");
      });
      this.addMenu.append(item);
    }
  }

  private renderModules(): void {
    this.frames.clear();
    this.surface.innerHTML = "";

    const byId = new Map(
      this.modules.map((module) => [module.manifest.id, module]),
    );

    for (const instance of this.layout.instances) {
      if (!instance.enabled) continue;
      const module = byId.get(instance.moduleId);
      if (!module) continue;

      const element = document.createElement("div");
      element.className = "module-frame";
      element.dataset.instanceId = instance.instanceId;
      element.dataset.moduleId = instance.moduleId;
      element.style.zIndex = String(instance.zIndex);

      let iframe: HTMLIFrameElement | undefined;
      let nativeRadar: NativeRadarRenderer | undefined;
      let moduleContent: HTMLElement;

      if (module.manifest.id === "com.apexhud.radar") {
        moduleContent = document.createElement("div");
        moduleContent.className = "native-module-host native-radar-host";
        nativeRadar = new NativeRadarRenderer(moduleContent);
      } else {
        iframe = document.createElement("iframe");
        iframe.className = "module-iframe";
        iframe.src = module.url;
        iframe.title = module.manifest.name;
        iframe.style.backgroundColor = "rgba(0, 0, 0, 0)";
        iframe.style.colorScheme = "dark";
        iframe.setAttribute("allowtransparency", "true");
        iframe.sandbox.add("allow-scripts");
        iframe.addEventListener("load", () => {
          this.sendInit(instance.instanceId);
          this.sendVisibility(instance.instanceId);
          if (this.latestFrame) {
            this.sendFrame(instance.instanceId, this.latestFrame);
          }
        });
        moduleContent = iframe;
      }

      const chrome = document.createElement("div");
      chrome.className = "module-edit-chrome";
      chrome.innerHTML = `
        <span>${escapeHtml(module.manifest.name)}</span>
        <span class="module-size"></span>
      `;
      chrome.addEventListener("pointerdown", (event) => {
        this.beginPointerAction(event, instance.instanceId, "drag");
      });

      const resize = document.createElement("div");
      resize.className = "module-resize-handle";
      resize.addEventListener("pointerdown", (event) => {
        this.beginPointerAction(event, instance.instanceId, "resize");
      });

      element.addEventListener("pointerdown", () => {
        if (this.editMode) this.select(instance.instanceId);
      });

      element.append(moduleContent, chrome, resize);
      this.surface.append(element);
      this.frames.set(instance.instanceId, {
        element,
        iframe,
        nativeRadar,
        instance,
        module,
      });

      if (nativeRadar) {
        this.sendInit(instance.instanceId);
        this.sendVisibility(instance.instanceId);
        if (this.latestFrame) {
          this.sendFrame(instance.instanceId, this.latestFrame);
        }
      }
    }

    this.positionFrames();
    this.updateSelection();
    this.updateRuntimeVisibility();
  }

  private positionFrames(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (const frame of this.frames.values()) {
      const bounds = sanitizeBounds(frame.instance.bounds);
      frame.element.style.left = `${bounds.x * width}px`;
      frame.element.style.top = `${bounds.y * height}px`;
      frame.element.style.width = `${bounds.width * width}px`;
      frame.element.style.height = `${bounds.height * height}px`;

      const size = frame.element.querySelector<HTMLElement>(".module-size");
      if (size) {
        size.textContent = `${Math.round(bounds.width * width)} × ${Math.round(bounds.height * height)}`;
      }
    }
  }

  private applyEditMode(): void {
    document.body.classList.toggle("is-editing", this.editMode);
    this.toolbar.classList.toggle("visible", this.editMode);
    this.inspector.classList.toggle("visible", this.editMode);
    this.addMenu.classList.remove("open");

    for (const instanceId of this.frames.keys()) {
      this.sendVisibility(instanceId);
    }
    this.updateRuntimeVisibility();

    if (!this.editMode) {
      this.selectedInstanceId = undefined;
      this.updateSelection();
      this.renderInspector();
    }
  }

  private select(instanceId: string): void {
    this.selectedInstanceId = instanceId;
    const selected = this.instance(instanceId);
    if (selected) {
      const top = Math.max(
        1,
        ...this.layout.instances.map((instance) => instance.zIndex),
      );
      if (selected.zIndex < top) {
        selected.zIndex = top + 1;
        this.frames.get(instanceId)!.element.style.zIndex = String(
          selected.zIndex,
        );
        this.queueSave();
      }
    }

    this.updateSelection();
    this.renderInspector();
  }

  private updateSelection(): void {
    for (const [instanceId, frame] of this.frames) {
      frame.element.classList.toggle(
        "selected",
        this.editMode && instanceId === this.selectedInstanceId,
      );
    }
  }

  private renderInspector(): void {
    this.inspector.innerHTML = "";
    if (!this.editMode || !this.selectedInstanceId) {
      this.inspector.classList.remove("has-selection");
      return;
    }

    const frame = this.frames.get(this.selectedInstanceId);
    if (!frame) return;

    this.inspector.classList.add("has-selection");

    const header = document.createElement("header");
    header.innerHTML = `
      <div class="inspector-kicker">${escapeHtml(this.t("widgetSettings").toUpperCase())}</div>
      <h2>${escapeHtml(frame.module.manifest.name)}</h2>
      <p>${escapeHtml(frame.module.manifest.description)}</p>
    `;
    this.inspector.append(header);

    for (const field of frame.module.manifest.settings) {
      this.inspector.append(this.createSetting(frame, field));
    }

    const actions = document.createElement("div");
    actions.className = "inspector-actions";
    const duplicate = this.button(this.t("duplicate"), () => {
      this.duplicateInstance(frame.instance);
    });
    const remove = this.button(this.t("remove"), () => {
      this.removeInstance(frame.instance.instanceId);
    });
    remove.classList.add("danger");
    actions.append(duplicate, remove);
    this.inspector.append(actions);
  }

  private createSetting(
    frame: FrameRecord,
    field: ModuleSettingField,
  ): HTMLElement {
    const row = document.createElement("label");
    row.className = "setting-row";

    const heading = document.createElement("span");
    heading.className = "setting-heading";
    const label = document.createElement("b");
    label.textContent = field.label;
    heading.append(label);
    if (field.help) {
      const help = document.createElement("small");
      help.textContent = field.help;
      heading.append(help);
    }

    const current = frame.instance.settings[field.key] ?? field.default;
    const control = this.settingControl(field, current, (value) => {
      frame.instance.settings[field.key] = value;
      this.sendSettings(frame.instance.instanceId);
      this.queueSave();
    });

    row.append(heading, control);
    return row;
  }

  private settingControl(
    field: ModuleSettingField,
    current: SettingValue,
    update: (value: SettingValue) => void,
  ): HTMLElement {
    if (field.type === "boolean") {
      const wrapper = document.createElement("span");
      wrapper.className = "switch";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(current);
      const visual = document.createElement("span");
      input.addEventListener("change", () => update(input.checked));
      wrapper.append(input, visual);
      return wrapper;
    }

    if (field.type === "select") {
      const options = (field.options ?? []).map((option) => ({
        value: String(option.value),
        label: option.label,
        sourceValue: option.value,
      }));
      return this.settingDropdown(String(current), options, (value) => {
        const selected = options.find((option) => option.value === value);
        update(selected?.sourceValue ?? value);
      });
    }

    if (field.type === "color") {
      return this.colorPicker(String(current), update);
    }

    const input = document.createElement("input");
    input.className = "setting-input";
    input.type = field.type === "number" ? "number" : "range";
    input.value = String(current);
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.step !== undefined) input.step = String(field.step);

    if (field.type === "number") {
      input.addEventListener("change", () => update(Number(input.value)));
      return input;
    }

    const range = document.createElement("span");
    range.className = "range-control";
    const output = document.createElement("output");
    output.textContent = String(current);
    input.addEventListener("input", () => {
      const value = Number(input.value);
      output.textContent = String(value);
      update(value);
    });
    range.append(input, output);
    return range;
  }

  private editorDropdown(
    label: string,
    current: string,
    options: ReadonlyArray<{ value: string; label: string; description?: string }>,
    onChange: (value: string) => void,
    extraClass = "",
  ): HTMLElement {
    const root = document.createElement("div");
    root.className = `editor-dropdown editor-popover-root ${extraClass}`.trim();
    const selected = options.find((option) => option.value === current) ?? options[0];

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "editor-dropdown-trigger";
    trigger.innerHTML = `<small>${escapeHtml(label)}</small><b>${escapeHtml(selected?.label ?? current)}</b><i>⌄</i>`;

    const menu = document.createElement("div");
    menu.className = "editor-dropdown-menu";
    for (const option of options) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `editor-dropdown-option${option.value === current ? " active" : ""}`;
      item.innerHTML = `<span><b>${escapeHtml(option.label)}</b>${option.description ? `<small>${escapeHtml(option.description)}</small>` : ""}</span>${option.value === current ? "<i>✓</i>" : ""}`;
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        root.classList.remove("open");
        onChange(option.value);
      });
      menu.append(item);
    }

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = !root.classList.contains("open");
      this.closeEditorPopovers(root);
      root.classList.toggle("open", willOpen);
    });
    root.append(trigger, menu);
    return root;
  }

  private settingDropdown(
    current: string,
    options: ReadonlyArray<{ value: string; label: string; sourceValue: SettingValue }>,
    onChange: (value: string) => void,
  ): HTMLElement {
    const root = document.createElement("div");
    root.className = "setting-dropdown editor-popover-root";
    const selected = options.find((option) => option.value === current) ?? options[0];
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "setting-dropdown-trigger";
    trigger.innerHTML = `<span>${escapeHtml(selected?.label ?? current)}</span><i>⌄</i>`;
    const menu = document.createElement("div");
    menu.className = "setting-dropdown-menu";
    for (const option of options) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = option.value === current ? "active" : "";
      item.textContent = option.label;
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        root.classList.remove("open");
        trigger.querySelector("span")!.textContent = option.label;
        onChange(option.value);
      });
      menu.append(item);
    }
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = !root.classList.contains("open");
      this.closeEditorPopovers(root);
      root.classList.toggle("open", willOpen);
    });
    root.append(trigger, menu);
    return root;
  }

  private colorPicker(current: string, update: (value: SettingValue) => void): HTMLElement {
    const root = document.createElement("div");
    root.className = "color-control editor-popover-root";
    let hsv = hexToHsv(normalizeHex(current));

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "color-trigger";
    trigger.innerHTML = `<span class="color-swatch"></span><code></code>`;

    const popover = document.createElement("div");
    popover.className = "color-popover";
    const area = document.createElement("div");
    area.className = "color-sv-area";
    const cursor = document.createElement("span");
    cursor.className = "color-sv-cursor";
    area.append(cursor);

    const hue = document.createElement("input");
    hue.type = "range";
    hue.className = "color-hue";
    hue.min = "0";
    hue.max = "360";
    hue.step = "1";

    const hex = document.createElement("input");
    hex.type = "text";
    hex.className = "color-hex";
    hex.maxLength = 7;
    hex.spellcheck = false;

    const sync = (emit: boolean): void => {
      const value = hsvToHex(hsv);
      const swatch = trigger.querySelector<HTMLElement>(".color-swatch")!;
      const code = trigger.querySelector<HTMLElement>("code")!;
      swatch.style.background = value;
      code.textContent = value.toUpperCase();
      area.style.setProperty("--picker-hue", `hsl(${hsv.h} 100% 50%)`);
      cursor.style.left = `${hsv.s * 100}%`;
      cursor.style.top = `${(1 - hsv.v) * 100}%`;
      hue.value = String(Math.round(hsv.h));
      hex.value = value.toUpperCase();
      if (emit) update(value);
    };

    const updateFromPointer = (event: PointerEvent): void => {
      const rect = area.getBoundingClientRect();
      hsv = {
        ...hsv,
        s: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        v: 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1),
      };
      sync(true);
    };

    area.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      area.setPointerCapture(event.pointerId);
      updateFromPointer(event);
    });
    area.addEventListener("pointermove", (event) => {
      if (!area.hasPointerCapture(event.pointerId)) return;
      updateFromPointer(event);
    });
    area.addEventListener("pointerup", (event) => {
      if (area.hasPointerCapture(event.pointerId)) area.releasePointerCapture(event.pointerId);
    });
    hue.addEventListener("input", () => {
      hsv = { ...hsv, h: Number(hue.value) };
      sync(true);
    });
    hex.addEventListener("change", () => {
      const normalized = normalizeHex(hex.value);
      hsv = hexToHsv(normalized);
      sync(true);
    });
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = !root.classList.contains("open");
      this.closeEditorPopovers(root);
      root.classList.toggle("open", willOpen);
    });

    popover.append(area, hue, hex);
    root.append(trigger, popover);
    sync(false);
    return root;
  }

  private closeEditorPopovers(except?: HTMLElement): void {
    for (const root of document.querySelectorAll<HTMLElement>(".editor-popover-root.open")) {
      if (root !== except) root.classList.remove("open");
    }
  }

  private beginPointerAction(
    event: PointerEvent,
    instanceId: string,
    kind: "drag" | "resize",
  ): void {
    if (!this.editMode) return;
    event.preventDefault();
    event.stopPropagation();
    this.select(instanceId);

    const frame = this.frames.get(instanceId);
    if (!frame) return;
    const rect = frame.element.getBoundingClientRect();

    this.pointerAction = {
      kind,
      instanceId,
      startX: event.clientX,
      startY: event.clientY,
      initial: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
    };
    frame.element.classList.add("manipulating");
  }

  private onPointerMove(event: PointerEvent): void {
    const action = this.pointerAction;
    if (!action) return;
    const frame = this.frames.get(action.instanceId);
    if (!frame) return;

    const dx = event.clientX - action.startX;
    const dy = event.clientY - action.startY;
    const grid = this.layout.snapGrid;
    const minimum = frame.module.manifest.minimumSize ?? {
      width: 120,
      height: 80,
    };

    if (action.kind === "drag") {
      const x = this.snap(
        Math.min(
          window.innerWidth - action.initial.width,
          Math.max(0, action.initial.x + dx),
        ),
        grid,
      );
      const y = this.snap(
        Math.min(
          window.innerHeight - action.initial.height,
          Math.max(0, action.initial.y + dy),
        ),
        grid,
      );
      frame.element.style.left = `${x}px`;
      frame.element.style.top = `${y}px`;
      frame.instance.bounds.x = x / window.innerWidth;
      frame.instance.bounds.y = y / window.innerHeight;
    } else {
      const width = this.snap(
        Math.min(
          window.innerWidth - action.initial.x,
          Math.max(minimum.width, action.initial.width + dx),
        ),
        grid,
      );
      const height = this.snap(
        Math.min(
          window.innerHeight - action.initial.y,
          Math.max(minimum.height, action.initial.height + dy),
        ),
        grid,
      );
      frame.element.style.width = `${width}px`;
      frame.element.style.height = `${height}px`;
      frame.instance.bounds.width = width / window.innerWidth;
      frame.instance.bounds.height = height / window.innerHeight;
    }

    const size = frame.element.querySelector<HTMLElement>(".module-size");
    if (size) {
      const rect = frame.element.getBoundingClientRect();
      size.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    }
  }

  private finishPointerAction(): void {
    if (!this.pointerAction) return;
    this.frames
      .get(this.pointerAction.instanceId)
      ?.element.classList.remove("manipulating");
    this.pointerAction = undefined;
    void this.saveLayout();
  }

  private async saveLayout(): Promise<void> {
    if (this.saveTimer !== undefined) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }

    this.markLayoutDirty();
    await this.flushLayoutSaves();
  }

  private queueSave(): void {
    this.markLayoutDirty();
    if (this.saveTimer !== undefined) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = undefined;
      void this.flushLayoutSaves();
    }, 180);
  }

  private markLayoutDirty(): void {
    this.commitCurrentLayout();
    this.layoutWriter.markDirty();
  }

  private commitCurrentLayout(): void {
    const scenario = this.editMode ? this.editorScenario : this.automaticScenario;
    commitLayoutForScenario(this.workspace, scenario, this.layout);
  }

  private async flushLayoutSaves(): Promise<void> {
    try {
      await this.layoutWriter.flush();
    } catch (error) {
      console.error("Could not save overlay layout", error);
    }
  }

  private addModule(module: DiscoveredModule): void {
    const offset = (this.layout.instances.length % 6) * 0.018;
    const instance: ModuleInstance = {
      instanceId: `${module.manifest.id.split(".").at(-1) ?? "widget"}-${crypto.randomUUID().slice(0, 8)}`,
      moduleId: module.manifest.id,
      enabled: true,
      zIndex:
        Math.max(0, ...this.layout.instances.map((item) => item.zIndex)) + 1,
      bounds: sanitizeBounds({
        ...module.manifest.defaultBounds,
        x: module.manifest.defaultBounds.x + offset,
        y: module.manifest.defaultBounds.y + offset,
      }),
      settings: defaultsFromManifest(module.manifest),
    };
    this.layout.instances.push(instance);
    this.renderModules();
    this.select(instance.instanceId);
    void this.saveLayout();
  }

  private duplicateInstance(source: ModuleInstance): void {
    const copy: ModuleInstance = structuredClone(source);
    copy.instanceId = `${source.instanceId}-copy-${crypto.randomUUID().slice(0, 4)}`;
    copy.bounds = sanitizeBounds({
      ...copy.bounds,
      x: copy.bounds.x + 0.02,
      y: copy.bounds.y + 0.02,
    });
    copy.zIndex =
      Math.max(0, ...this.layout.instances.map((item) => item.zIndex)) + 1;
    this.layout.instances.push(copy);
    this.renderModules();
    this.select(copy.instanceId);
    void this.saveLayout();
  }

  private removeInstance(instanceId: string): void {
    this.layout.instances = this.layout.instances.filter(
      (instance) => instance.instanceId !== instanceId,
    );
    this.selectedInstanceId = undefined;
    this.renderModules();
    this.renderInspector();
    void this.saveLayout();
  }

  private instance(instanceId: string): ModuleInstance | undefined {
    return this.layout.instances.find(
      (instance) => instance.instanceId === instanceId,
    );
  }

  private sendInit(instanceId: string): void {
    const frame = this.frames.get(instanceId);
    if (!frame) return;

    if (frame.nativeRadar) {
      frame.nativeRadar.setSettings(frame.instance.settings);
      return;
    }

    this.post(frame, {
      type: "apex:init",
      protocolVersion: PROTOCOL_VERSION,
      moduleId: frame.module.manifest.id,
      instanceId,
      settings: frame.instance.settings,
      source: this.latestFrame?.source ?? "none",
    });
  }

  private sendFrame(
    instanceId: string,
    snapshot: TelemetrySnapshot,
  ): void {
    const frame = this.frames.get(instanceId);
    if (!frame) return;

    if (frame.nativeRadar) {
      frame.nativeRadar.setRadar(snapshot.radar);
      return;
    }

    const payload: Record<string, unknown> = {
      source: snapshot.source,
    };
    for (const scope of frame.module.manifest.scopes) {
      payload[scope] = snapshot[scope];
    }

    this.post(frame, {
      type: "apex:frame",
      protocolVersion: snapshot.protocolVersion,
      sequence: snapshot.sequence,
      timestamp: snapshot.timestamp,
      payload,
    });
  }

  private sendSettings(instanceId: string): void {
    const frame = this.frames.get(instanceId);
    if (!frame) return;
    if (frame.nativeRadar) {
      frame.nativeRadar.setSettings(frame.instance.settings);
      return;
    }
    this.post(frame, {
      type: "apex:settings",
      settings: frame.instance.settings,
    });
  }

  private sendVisibility(instanceId: string): void {
    const frame = this.frames.get(instanceId);
    if (!frame) return;
    const visible = this.editMode || this.sessionActive;
    if (frame.nativeRadar) {
      frame.nativeRadar.setVisibility(visible, this.editMode);
      return;
    }
    this.post(frame, {
      type: "apex:visibility",
      visible,
      editMode: this.editMode,
    });
  }

  private post(frame: FrameRecord, message: HostToModuleMessage): void {
    frame.iframe?.contentWindow?.postMessage(message, "*");
  }

  private onTelemetry(frame: TelemetrySnapshot): void {
    this.latestFrame = frame;
    const nextScenario = scenarioFromTelemetry(frame);
    if (nextScenario !== this.automaticScenario) {
      this.automaticScenario = nextScenario;
      if (!this.editMode) {
        this.refreshActiveLayout();
        this.selectedInstanceId = undefined;
        this.renderModules();
      }
      this.renderToolbar();
    }

    this.updateSessionActive(
      isRaceOverlayActive(frame, this.preferences.overlayAutoHideMode),
    );

    for (const instanceId of this.frames.keys()) {
      this.sendFrame(instanceId, frame);
    }
    this.updateRuntimeVisibility();
    this.updateStatusPill();
  }

  private onTelemetryStatus(status: TelemetryStatus): void {
    this.telemetryStatus = status;
    if (status !== "connected") {
      this.updateSessionActive(false);
    }
    this.updateStatusPill();
  }

  private updateSessionActive(active: boolean): void {
    if (this.editMode && !active) return;
    if (this.sessionActive === active) return;

    this.sessionActive = active;
    void window.apexDesktop.setSessionActive(active);
    for (const instanceId of this.frames.keys()) {
      this.sendVisibility(instanceId);
    }
  }

  private updateRuntimeVisibility(): void {
    for (const frame of this.frames.values()) {
      frame.element.classList.toggle(
        "runtime-hidden",
        shouldHideModuleAtRuntime(frame.module, this.latestFrame, this.editMode),
      );
    }
  }

  private updateStatusPill(): void {
    const source = this.latestFrame?.source;
    const label =
      this.telemetryStatus !== "connected"
        ? this.t("telemetryReconnectShort")
        : source === "iracing"
          ? this.t("liveIRacingShort")
          : source === "mock"
            ? this.t("demoData")
            : this.t("waitingForIRacing");

    this.statusPill.className = `telemetry-pill source-${source ?? "none"}`;
    this.statusPill.innerHTML = `<i></i><span>${label}</span>`;
  }

  private onModuleMessage(event: MessageEvent): void {
    const owner = [...this.frames.values()].find(
      (frame) => frame.iframe?.contentWindow === event.source,
    );
    if (!owner) return;

    const data = event.data as { type?: string; level?: string; message?: string };
    if (data?.type === "apex:log") {
      const method =
        data.level === "error"
          ? console.error
          : data.level === "warn"
            ? console.warn
            : console.log;
      const message = String(data.message ?? "").slice(0, 2_000);
      method(`[module:${owner.module.manifest.id}] ${message}`);
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.editMode) return;
    if (event.key === "Delete" && this.selectedInstanceId) {
      this.removeInstance(this.selectedInstanceId);
    } else if (event.key === "Escape") {
      this.selectedInstanceId = undefined;
      this.updateSelection();
      this.renderInspector();
      this.addMenu.classList.remove("open");
    } else if (
      event.key.toLowerCase() === "s" &&
      (event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      void this.saveLayout();
    }
  }

  private toggleAddMenu(): void {
    this.addMenu.classList.toggle("open");
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toolbar-button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  private snap(value: number, grid: number): number {
    return Math.round(value / grid) * grid;
  }
}

interface HsvColor {
  h: number;
  s: number;
  v: number;
}

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  const short = /^#?([0-9a-f]{3})$/i.exec(trimmed);
  if (short?.[1]) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = /^#?([0-9a-f]{6})/i.exec(trimmed);
  return full?.[1] ? `#${full[1].toLowerCase()}` : "#ffffff";
}

function hexToHsv(value: string): HsvColor {
  const hex = normalizeHex(value).slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToHex(color: HsvColor): string {
  const h = ((color.h % 360) + 360) % 360;
  const c = color.v * color.s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = color.v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return `#${rgb.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

void new OverlayApplication().start();
