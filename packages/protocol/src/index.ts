export const PROTOCOL_VERSION = 6 as const;

export const DATA_SCOPES = [
  "connection",
  "session",
  "player",
  "vehicle",
  "driverAids",
  "pit",
  "environment",
  "motion",
  "timing",
  "fuel",
  "radar",
  "relative",
  "standings",
] as const;

export type DataScope = (typeof DATA_SCOPES)[number];

export interface SimulatorWindowState {
  processRunning: boolean;
  windowFound: boolean;
  isVisible: boolean;
  isMinimized: boolean;
  isForeground: boolean;
}

export interface ConnectionState {
  connected: boolean;
  status: string;
  tickRate: number;
  framesDropped: number;
  simulatorWindow: SimulatorWindowState;
}

export interface SessionState {
  sessionNumber: number;
  state: number;
  sessionType: string;
  sessionName: string;
  eventType: string;
  trackName: string;
  trackLengthMeters: number;
  sessionTimeSeconds: number;
  timeOfDaySeconds?: number;
  timeRemainingSeconds: number;
  hasTimeLimit: boolean;
  lapsRemaining: number;
  hasLapLimit: boolean;
  flags: number;
  isReplayPlaying: boolean;
  isInGarage: boolean;
}

export interface PlayerState {
  carIndex: number;
  name: string;
  carNumber: string;
  teamName: string;
  carClassId: number;
  carClassName: string;
  iRating: number;
  license: string;
  position: number;
  classPosition: number;
  lap: number;
  lapDistancePercent: number;
  speedMetersPerSecond: number;
  fuelLiters: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  incidentCount: number;
  onPitRoad: boolean;
  isOnTrack: boolean;
}

export interface VehicleState {
  speedMetersPerSecond: number;
  gear: number;
  rpm: number;
  shiftLightFirstRpm?: number;
  shiftRpm: number;
  shiftLightLastRpm?: number;
  shiftLightBlinkRpm?: number;
  throttle: number;
  throttleRaw?: number;
  brake: number;
  brakeRaw?: number;
  clutch: number;
  handbrake?: number;
  handbrakeRaw?: number;
  steeringWheelAngleRadians: number;
  steeringWheelAngleMaxRadians?: number;
  shiftIndicatorPercent?: number;
  shiftPowerPercent?: number;
  onPitRoad: boolean;
  trackSurface: number;
  trackSurfaceMaterial: number;
}

export interface DriverAidsState {
  /** True when iRacing exposes a live ABS signal in the current context. */
  absAvailable: boolean;
  /** True while ABS is actively reducing brake pressure. */
  absActive: boolean;
  absCutPercent?: number;
  /** True when one or more traction-control controls are exposed. */
  tractionControlAvailable: boolean;
  /** Current TC toggle state. This is not a generic TC-intervention signal. */
  tractionControlEnabled: boolean;
  tractionControlLevel?: number;
  tractionControlLevel2?: number;
  brakeBiasAvailable: boolean;
  brakeBiasPercent?: number;
  pitLimiterAvailable: boolean;
  pitLimiterActive: boolean;
  revLimiterActive: boolean;
  engineWarningsAvailable: boolean;
  engineWarnings: number;
  waterTemperatureWarning: boolean;
  fuelPressureWarning: boolean;
  oilPressureWarning: boolean;
  oilTemperatureWarning: boolean;
  engineStalled: boolean;
}

export interface PitState {
  dataAvailable: boolean;
  pitsOpen?: boolean;
  inPitStall: boolean;
  pitstopActive: boolean;
  serviceStatus?: number;
  towSeconds?: number;
  mandatoryRepairSeconds?: number;
  optionalRepairSeconds?: number;
  fastRepairsUsed?: number;
  fastRepairsAvailable?: number;
  serviceFlags?: number;
  fuelToAddLiters?: number;
  leftFrontPressureKpa?: number;
  rightFrontPressureKpa?: number;
  leftRearPressureKpa?: number;
  rightRearPressureKpa?: number;
  tireCompound?: number;
}

export interface EnvironmentState {
  dataAvailable: boolean;
  airTemperatureCelsius?: number;
  trackTemperatureCelsius?: number;
  trackWetness?: number;
  weatherDeclaredWet?: boolean;
  precipitationPercent?: number;
  relativeHumidityPercent?: number;
  windSpeedMetersPerSecond?: number;
  windDirectionRadians?: number;
  fogLevelPercent?: number;
  skies?: number;
}

export interface MotionState {
  dataAvailable: boolean;
  velocityXMetersPerSecond?: number;
  velocityYMetersPerSecond?: number;
  velocityZMetersPerSecond?: number;
  lateralAccelerationMetersPerSecondSquared?: number;
  longitudinalAccelerationMetersPerSecondSquared?: number;
  verticalAccelerationMetersPerSecondSquared?: number;
  yawRadians?: number;
  yawRateRadiansPerSecond?: number;
  pitchRadians?: number;
  pitchRateRadiansPerSecond?: number;
  rollRadians?: number;
  rollRateRadiansPerSecond?: number;
  steeringWheelTorqueNm?: number;
}

export type LapValidity = "valid" | "invalid" | "unavailable" | string;

export interface TimingState {
  currentLap: number;
  completedLaps: number;
  currentLapSeconds: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  deltaToBestSeconds: number;
  deltaAvailable: boolean;
  deltaToOptimalLapSeconds: number;
  deltaToOptimalLapAvailable: boolean;
  deltaToSessionBestLapSeconds: number;
  deltaToSessionBestLapAvailable: boolean;
  deltaToSessionOptimalLapSeconds: number;
  deltaToSessionOptimalLapAvailable: boolean;
  deltaToLastLapSeconds: number;
  deltaToLastLapAvailable: boolean;
  currentLapValid: boolean;
  validity: LapValidity;
}

export interface FuelState {
  levelLiters: number;
  usePerHourLiters: number;
  estimatedPerLapLiters: number;
  estimatedLapsRemaining: number;
  requiredToFinishLiters: number;
  addToFinishLiters: number;
  samples: number;
  estimateReady: boolean;
}

export type RadarSide = "left" | "right" | "unknown";
export type RadarThreat = "nearby" | "warning" | "critical" | "fast-approach";

export interface RadarContact {
  carIndex: number;
  side: RadarSide;
  longitudinalMeters: number;
  closingSpeedMetersPerSecond: number;
  overlap: number;
  threat: RadarThreat;
  confidence: number;
  isApproaching: boolean;
}

export interface RadarState {
  spotterState: string;
  active: boolean;
  contacts: RadarContact[];
}

export interface RelativeEntry {
  carIndex: number;
  carNumber: string;
  driverName: string;
  carClassName: string;
  position: number;
  relation: "ahead" | "behind" | string;
  distanceMeters: number;
  estimatedGapSeconds: number;
  onPitRoad: boolean;
  isPlayer: boolean;
}

export interface RelativeState {
  entries: RelativeEntry[];
}

export interface StandingEntry {
  carIndex: number;
  position: number;
  classPosition: number;
  carNumber: string;
  driverName: string;
  teamName: string;
  carClassId: number;
  carClassName: string;
  iRating: number;
  license: string;
  lap: number;
  lapDistancePercent: number;
  gapToLeaderSeconds: number;
  intervalSeconds: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  incidentCount: number;
  onPitRoad: boolean;
  isPlayer: boolean;
  status: "running" | "pit" | "out" | string;
}

export interface StandingsState {
  mode: "overall" | "class" | string;
  entries: StandingEntry[];
}

export interface TelemetrySnapshot {
  protocolVersion: number;
  sequence: number;
  timestamp: string;
  source: "iracing" | "mock" | "none" | string;
  connection: ConnectionState;
  session: SessionState;
  player: PlayerState;
  vehicle: VehicleState;
  driverAids: DriverAidsState;
  pit: PitState;
  environment: EnvironmentState;
  motion: MotionState;
  timing: TimingState;
  fuel: FuelState;
  radar: RadarState;
  relative: RelativeState;
  standings: StandingsState;
}

export type SettingValue = string | number | boolean;

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface ModuleSettingField {
  key: string;
  label: string;
  type: "boolean" | "range" | "color" | "select" | "number";
  default: SettingValue;
  min?: number;
  max?: number;
  step?: number;
  options?: SelectOption[];
  help?: string;
}

export interface ModuleManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  entry: string;
  scopes: DataScope[];
  defaultBounds: NormalizedBounds;
  minimumSize?: {
    width: number;
    height: number;
  };
  settings: ModuleSettingField[];
}

export interface NormalizedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModuleInstance {
  instanceId: string;
  moduleId: string;
  enabled: boolean;
  zIndex: number;
  bounds: NormalizedBounds;
  settings: Record<string, SettingValue>;
}

export interface LayoutDocument {
  schemaVersion: 1;
  migrationVersion?: number;
  display: "primary" | string;
  snapGrid: number;
  instances: ModuleInstance[];
}


export const LAYOUT_SCENARIOS = [
  "default",
  "test-drive",
  "practice",
  "qualifying",
  "race",
  "replay",
] as const;

export type LayoutScenario = (typeof LAYOUT_SCENARIOS)[number];

export interface ModuleInstanceOverride {
  enabled?: boolean;
  zIndex?: number;
  bounds?: NormalizedBounds;
  settings?: Record<string, SettingValue>;
}

/**
 * The `default` scenario is the Base Layout. Child profiles keep only local
 * modules plus precise overrides/tombstones for inherited base instances.
 */
export interface LayoutProfile {
  scenario: LayoutScenario;
  name: string;
  layout: LayoutDocument;
  hiddenBaseInstanceIds?: string[];
  baseOverrides?: Record<string, ModuleInstanceOverride>;
}

export interface LayoutGroup {
  id: string;
  name: string;
  profiles: Record<LayoutScenario, LayoutProfile>;
}

export interface LayoutWorkspace {
  schemaVersion: 3;
  migrationVersion?: number;
  activeGroupId: string;
  groups: LayoutGroup[];
}

export interface LayoutTarget {
  groupId: string;
  scenario: LayoutScenario;
}

export type OverlayAutoHideMode = "not-foreground" | "minimized" | "never";

export type AppLocale =
  | "en"
  | "ru"
  | "de"
  | "fr"
  | "es"
  | "it"
  | "pt-BR"
  | "pl"
  | "zh-CN"
  | "ja";

export interface AppPreferences {
  schemaVersion: 3;
  locale: AppLocale;
  overlayAutoHideMode: OverlayAutoHideMode;
  communityRepositoryUrl: string;
  communityBranch: string;
  autoCheckCommunityUpdates: boolean;
}

export type ModuleSource = "built-in" | "local" | "community";

export interface DiscoveredModule {
  manifest: ModuleManifest;
  url: string;
  source: ModuleSource;
  previewUrl?: string;
}

export type CommunityModuleStatus = "available" | "installed" | "update-available";

export interface CommunityModuleEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  sourceDirectory: string;
  previewDataUrl?: string;
  installedVersion?: string;
  status: CommunityModuleStatus;
}

export interface CommunityCatalogState {
  repositoryUrl: string;
  branch: string;
  gitAvailable: boolean;
  gitVersion: string;
  lastUpdatedAt: string;
  repositoryCommit: string;
  entries: CommunityModuleEntry[];
  error: string;
}

export interface ApexInitMessage {
  type: "apex:init";
  protocolVersion: number;
  moduleId: string;
  instanceId: string;
  settings: Record<string, SettingValue>;
  source: string;
}

export interface ApexFrameMessage {
  type: "apex:frame";
  protocolVersion: number;
  sequence: number;
  timestamp: string;
  payload: Partial<TelemetrySnapshot>;
}

export interface ApexSettingsMessage {
  type: "apex:settings";
  settings: Record<string, SettingValue>;
}

export interface ApexVisibilityMessage {
  type: "apex:visibility";
  visible: boolean;
  editMode: boolean;
}

export type HostToModuleMessage =
  | ApexInitMessage
  | ApexFrameMessage
  | ApexSettingsMessage
  | ApexVisibilityMessage;

export interface ModuleReadyMessage {
  type: "apex:ready";
  moduleId: string;
}

export interface ModuleLogMessage {
  type: "apex:log";
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

export type ModuleToHostMessage = ModuleReadyMessage | ModuleLogMessage;

export function isTelemetrySnapshot(value: unknown): value is TelemetrySnapshot {
  if (!isRecord(value)) return false;
  return (
    typeof value.protocolVersion === "number" &&
    typeof value.sequence === "number" &&
    typeof value.timestamp === "string" &&
    isConnectionState(value.connection) &&
    isSessionState(value.session) &&
    isPlayerState(value.player) &&
    isVehicleState(value.vehicle) &&
    isDriverAidsState(value.driverAids) &&
    isPitState(value.pit) &&
    isEnvironmentState(value.environment) &&
    isMotionState(value.motion) &&
    isTimingState(value.timing) &&
    isFuelState(value.fuel) &&
    isRadarState(value.radar) &&
    isRelativeState(value.relative) &&
    isStandingsState(value.standings)
  );
}

export function isModuleManifest(value: unknown): value is ModuleManifest {
  return validateModuleManifest(value).valid;
}

export function validateModuleManifest(value: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["manifest must be an object"] };

  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!isSafeModuleId(value.id)) errors.push("id must be a reverse-DNS identifier");
  if (!isShortText(value.name, 1, 80)) errors.push("name must contain 1-80 characters");
  if (!isShortText(value.description, 1, 300)) errors.push("description must contain 1-300 characters");
  if (!isShortText(value.version, 1, 40)) errors.push("version is required");
  if (!isShortText(value.author, 1, 100)) errors.push("author is required");
  if (!isSafeRelativePath(value.entry)) errors.push("entry must be a safe relative path");

  if (!Array.isArray(value.scopes) || value.scopes.length === 0) {
    errors.push("scopes must contain at least one data scope");
  } else if (
    value.scopes.some(
      (scope) => typeof scope !== "string" || !DATA_SCOPES.includes(scope as DataScope),
    )
  ) {
    errors.push("scopes contains an unsupported value");
  }

  if (!isBounds(value.defaultBounds)) errors.push("defaultBounds is invalid");

  if (value.minimumSize !== undefined) {
    if (
      !isRecord(value.minimumSize) ||
      !isFiniteInRange(value.minimumSize.width, 40, 10_000) ||
      !isFiniteInRange(value.minimumSize.height, 40, 10_000)
    ) {
      errors.push("minimumSize must contain sensible pixel dimensions");
    }
  }

  if (!Array.isArray(value.settings) || value.settings.length > 64) {
    errors.push("settings must be an array with at most 64 fields");
  } else {
    const keys = new Set<string>();
    for (const [index, setting] of value.settings.entries()) {
      const prefix = `settings[${index}]`;
      if (!isRecord(setting)) {
        errors.push(`${prefix} must be an object`);
        continue;
      }
      if (!isIdentifier(setting.key)) errors.push(`${prefix}.key is invalid`);
      else if (keys.has(setting.key)) errors.push(`${prefix}.key is duplicated`);
      else keys.add(setting.key);
      if (!isShortText(setting.label, 1, 80)) errors.push(`${prefix}.label is invalid`);
      const settingType = String(setting.type);
      if (!SETTING_TYPES.has(settingType)) errors.push(`${prefix}.type is invalid`);
      if (!isSettingValue(setting.default)) errors.push(`${prefix}.default is invalid`);
      else validateSettingDefault(setting, settingType, prefix, errors);
      if (setting.help !== undefined && !isShortText(setting.help, 1, 240)) {
        errors.push(`${prefix}.help is invalid`);
      }
      if (setting.min !== undefined && !Number.isFinite(setting.min)) errors.push(`${prefix}.min is invalid`);
      if (setting.max !== undefined && !Number.isFinite(setting.max)) errors.push(`${prefix}.max is invalid`);
      if (setting.step !== undefined && (!Number.isFinite(setting.step) || Number(setting.step) <= 0)) {
        errors.push(`${prefix}.step is invalid`);
      }
      if (setting.type === "select") {
        if (!Array.isArray(setting.options) || setting.options.length === 0 || setting.options.length > 50) {
          errors.push(`${prefix}.options is invalid`);
        } else if (setting.options.some((option) => !isSelectOption(option))) {
          errors.push(`${prefix}.options contains an invalid item`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function defaultsFromManifest(
  manifest: ModuleManifest,
): Record<string, SettingValue> {
  return Object.fromEntries(
    manifest.settings.map((field) => [field.key, field.default]),
  );
}

export function sanitizeBounds(bounds: NormalizedBounds): NormalizedBounds {
  const width = clamp(finiteOr(bounds.width, 0.2), 0.04, 1);
  const height = clamp(finiteOr(bounds.height, 0.2), 0.04, 1);
  return {
    x: clamp(finiteOr(bounds.x, 0), 0, 1 - width),
    y: clamp(finiteOr(bounds.y, 0), 0, 1 - height),
    width,
    height,
  };
}

/** Resolve a profile into the concrete layout rendered by the overlay. */
export function resolveLayoutProfile(
  group: LayoutGroup,
  scenario: LayoutScenario,
): LayoutDocument {
  const base = group.profiles.default.layout;
  if (scenario === "default") return structuredClone(base);

  const profile = group.profiles[scenario];
  const hidden = new Set(profile.hiddenBaseInstanceIds ?? []);
  const overrides = profile.baseOverrides ?? {};
  const localIds = new Set(profile.layout.instances.map((instance) => instance.instanceId));
  const inherited = base.instances
    .filter((instance) => !hidden.has(instance.instanceId) && !localIds.has(instance.instanceId))
    .map((instance) => applyModuleOverride(instance, overrides[instance.instanceId]));

  return {
    schemaVersion: 1,
    migrationVersion: Math.max(
      Number(base.migrationVersion ?? 0),
      Number(profile.layout.migrationVersion ?? 0),
    ),
    display: profile.layout.display || base.display,
    snapGrid: profile.layout.snapGrid || base.snapGrid,
    instances: [...inherited, ...structuredClone(profile.layout.instances)],
  };
}

/** Store an edited concrete layout as Base Layout or as a child delta. */
export function writeResolvedLayoutToGroup(
  group: LayoutGroup,
  scenario: LayoutScenario,
  resolved: LayoutDocument,
): void {
  if (scenario === "default") {
    group.profiles.default.layout = structuredClone(resolved);
    return;
  }

  const base = group.profiles.default.layout;
  const baseById = new Map(base.instances.map((item) => [item.instanceId, item]));
  const resolvedById = new Map(resolved.instances.map((item) => [item.instanceId, item]));
  const hiddenBaseInstanceIds = base.instances
    .filter((item) => !resolvedById.has(item.instanceId))
    .map((item) => item.instanceId);
  const baseOverrides: Record<string, ModuleInstanceOverride> = {};

  for (const baseInstance of base.instances) {
    const current = resolvedById.get(baseInstance.instanceId);
    if (!current) continue;
    const override = diffModuleInstance(baseInstance, current);
    if (Object.keys(override).length > 0) {
      baseOverrides[baseInstance.instanceId] = override;
    }
  }

  const localInstances = resolved.instances
    .filter((item) => !baseById.has(item.instanceId))
    .map((item) => structuredClone(item));
  const profile = group.profiles[scenario];
  profile.layout = {
    schemaVersion: 1,
    ...(resolved.migrationVersion === undefined ? {} : { migrationVersion: resolved.migrationVersion }),
    display: resolved.display,
    snapGrid: resolved.snapGrid,
    instances: localInstances,
  };
  profile.hiddenBaseInstanceIds = hiddenBaseInstanceIds;
  profile.baseOverrides = baseOverrides;
}

export function resetProfileToBase(
  group: LayoutGroup,
  scenario: LayoutScenario,
): LayoutDocument {
  if (scenario === "default") return structuredClone(group.profiles.default.layout);
  const base = group.profiles.default.layout;
  const profile = group.profiles[scenario];
  profile.layout = {
    schemaVersion: 1,
    ...(base.migrationVersion === undefined ? {} : { migrationVersion: base.migrationVersion }),
    display: base.display,
    snapGrid: base.snapGrid,
    instances: [],
  };
  profile.hiddenBaseInstanceIds = [];
  profile.baseOverrides = {};
  return resolveLayoutProfile(group, scenario);
}

export function copyLayoutTarget(
  workspace: LayoutWorkspace,
  source: LayoutTarget,
  target: LayoutTarget,
): LayoutDocument {
  const sourceGroup = workspace.groups.find((group) => group.id === source.groupId);
  const targetGroup = workspace.groups.find((group) => group.id === target.groupId);
  if (!sourceGroup || !targetGroup) {
    throw new Error("Layout source or target group was not found");
  }
  const copy = resolveLayoutProfile(sourceGroup, source.scenario);
  writeResolvedLayoutToGroup(targetGroup, target.scenario, copy);
  return resolveLayoutProfile(targetGroup, target.scenario);
}

export function moduleInheritanceKind(
  group: LayoutGroup,
  scenario: LayoutScenario,
  instanceId: string,
): "base" | "override" | "local" {
  if (scenario === "default") return "base";
  const baseHas = group.profiles.default.layout.instances.some(
    (instance) => instance.instanceId === instanceId,
  );
  if (!baseHas) return "local";
  return group.profiles[scenario].baseOverrides?.[instanceId]
    ? "override"
    : "base";
}

function applyModuleOverride(
  source: ModuleInstance,
  override: ModuleInstanceOverride | undefined,
): ModuleInstance {
  if (!override) return structuredClone(source);
  return {
    ...structuredClone(source),
    ...(override.enabled === undefined ? {} : { enabled: override.enabled }),
    ...(override.zIndex === undefined ? {} : { zIndex: override.zIndex }),
    ...(override.bounds === undefined ? {} : { bounds: structuredClone(override.bounds) }),
    settings: {
      ...structuredClone(source.settings),
      ...(override.settings ?? {}),
    },
  };
}

function diffModuleInstance(
  base: ModuleInstance,
  current: ModuleInstance,
): ModuleInstanceOverride {
  const result: ModuleInstanceOverride = {};
  if (base.enabled !== current.enabled) result.enabled = current.enabled;
  if (base.zIndex !== current.zIndex) result.zIndex = current.zIndex;
  if (!sameNormalizedBounds(base.bounds, current.bounds)) {
    result.bounds = structuredClone(current.bounds);
  }

  const settings: Record<string, SettingValue> = {};
  const keys = new Set([...Object.keys(base.settings), ...Object.keys(current.settings)]);
  for (const key of keys) {
    const baseValue = base.settings[key];
    const currentValue = current.settings[key];
    if (currentValue !== undefined && currentValue !== baseValue) {
      settings[key] = currentValue;
    }
  }
  if (Object.keys(settings).length > 0) result.settings = settings;
  return result;
}

function sameNormalizedBounds(left: NormalizedBounds, right: NormalizedBounds): boolean {
  const epsilon = 0.000_001;
  return (
    Math.abs(left.x - right.x) <= epsilon &&
    Math.abs(left.y - right.y) <= epsilon &&
    Math.abs(left.width - right.width) <= epsilon &&
    Math.abs(left.height - right.height) <= epsilon
  );
}

const SETTING_TYPES = new Set(["boolean", "range", "color", "select", "number"]);

function isConnectionState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.connected === "boolean" &&
    typeof value.status === "string" &&
    isSimulatorWindowState(value.simulatorWindow)
  );
}

function isSimulatorWindowState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.processRunning === "boolean" &&
    typeof value.windowFound === "boolean" &&
    typeof value.isVisible === "boolean" &&
    typeof value.isMinimized === "boolean" &&
    typeof value.isForeground === "boolean"
  );
}

function isSessionState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.trackName === "string" &&
    typeof value.sessionType === "string" &&
    typeof value.sessionName === "string" &&
    typeof value.eventType === "string" &&
    typeof value.hasTimeLimit === "boolean" &&
    typeof value.hasLapLimit === "boolean"
  );
}

function isPlayerState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.carIndex === "number" &&
    typeof value.name === "string" &&
    typeof value.incidentCount === "number"
  );
}

function isVehicleState(value: unknown): boolean {
  return isRecord(value) && typeof value.gear === "number" && typeof value.rpm === "number";
}

function isDriverAidsState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.absAvailable === "boolean" &&
    typeof value.absActive === "boolean" &&
    typeof value.tractionControlAvailable === "boolean" &&
    typeof value.tractionControlEnabled === "boolean" &&
    typeof value.engineWarningsAvailable === "boolean"
  );
}

function isPitState(value: unknown): boolean {
  return isRecord(value) && typeof value.dataAvailable === "boolean";
}

function isEnvironmentState(value: unknown): boolean {
  return isRecord(value) && typeof value.dataAvailable === "boolean";
}

function isMotionState(value: unknown): boolean {
  return isRecord(value) && typeof value.dataAvailable === "boolean";
}

function isTimingState(value: unknown): boolean {
  return isRecord(value) && typeof value.validity === "string" && typeof value.deltaAvailable === "boolean";
}

function isFuelState(value: unknown): boolean {
  return isRecord(value) && typeof value.levelLiters === "number" && typeof value.estimateReady === "boolean";
}

function isRadarState(value: unknown): boolean {
  return isRecord(value) && typeof value.active === "boolean" && Array.isArray(value.contacts);
}

function isRelativeState(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.entries);
}

function isStandingsState(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.entries);
}

function isSafeModuleId(value: unknown): value is string {
  return typeof value === "string" && /^(?:[a-z0-9][a-z0-9-]*\.)+[a-z0-9][a-z0-9-]*$/.test(value) && value.length <= 120;
}

function isSafeRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 240) return false;
  if (value.includes("\\") || value.startsWith("/") || value.includes("\0")) return false;
  return value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(value);
}

function isShortText(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value.trim().length >= minimum && value.length <= maximum;
}

function validateSettingDefault(
  setting: Record<string, unknown>,
  type: string,
  prefix: string,
  errors: string[],
): void {
  const value = setting.default;
  if (type === "boolean" && typeof value !== "boolean") {
    errors.push(`${prefix}.default must be boolean`);
    return;
  }

  if ((type === "range" || type === "number") && typeof value !== "number") {
    errors.push(`${prefix}.default must be numeric`);
    return;
  }

  if (type === "color" && (typeof value !== "string" || !/^#[0-9a-f]{3,8}$/i.test(value))) {
    errors.push(`${prefix}.default must be a hex color`);
    return;
  }

  if (typeof value === "number") {
    if (typeof setting.min === "number" && value < setting.min) {
      errors.push(`${prefix}.default is below min`);
    }
    if (typeof setting.max === "number" && value > setting.max) {
      errors.push(`${prefix}.default is above max`);
    }
    if (
      typeof setting.min === "number" &&
      typeof setting.max === "number" &&
      setting.min > setting.max
    ) {
      errors.push(`${prefix}.min must not exceed max`);
    }
  }

  if (type === "select" && Array.isArray(setting.options)) {
    const values = setting.options
      .filter(isSelectOption)
      .map((option) => option.value);
    if (!values.some((candidate) => candidate === value)) {
      errors.push(`${prefix}.default must match an option`);
    }
    if (new Set(values.map(String)).size !== values.length) {
      errors.push(`${prefix}.options contains duplicate values`);
    }
  }
}

function isBounds(value: unknown): value is NormalizedBounds {
  if (
    !isRecord(value) ||
    !isFiniteInRange(value.x, 0, 1) ||
    !isFiniteInRange(value.y, 0, 1) ||
    !isFiniteInRange(value.width, 0.01, 1) ||
    !isFiniteInRange(value.height, 0.01, 1)
  ) {
    return false;
  }

  return value.x + value.width <= 1.000_001 && value.y + value.height <= 1.000_001;
}

function isSelectOption(value: unknown): value is SelectOption {
  return isRecord(value) && isShortText(value.label, 1, 80) && (typeof value.value === "string" || typeof value.value === "number");
}

function isSettingValue(value: unknown): value is SettingValue {
  return typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
}

function isFiniteInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
