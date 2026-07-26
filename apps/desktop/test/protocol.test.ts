import { describe, expect, it } from 'vitest';
import {
  defaultsFromManifest,
  HOTKEY_ACTIONS,
  LAYOUT_SCENARIOS,
  sanitizeBounds,
  validateModuleManifest,
  type ModuleManifest,
} from '@apexhud/protocol';

const manifest: ModuleManifest = {
  schemaVersion: 1,
  id: 'com.example.apexhud.test',
  name: 'Test widget',
  description: 'A valid test module.',
  version: '1.0.0',
  author: 'ApexHUD tests',
  entry: 'index.html',
  scopes: ['session', 'player'],
  defaultBounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
  minimumSize: { width: 200, height: 100 },
  settings: [
    { key: 'accent', label: 'Accent', type: 'color', default: '#fff' },
    { key: 'rows', label: 'Rows', type: 'range', default: 12, min: 5, max: 30, step: 1 },
  ],
};

describe('module protocol', () => {
  it('exposes the session modes and assignable hotkey actions', () => {
    expect(LAYOUT_SCENARIOS).toContain('time-trial');
    expect(HOTKEY_ACTIONS).toEqual(['editLayout', 'toggleOverlay', 'openControlCenter']);
  });

  it('accepts a valid manifest', () => {
    expect(validateModuleManifest(manifest)).toEqual({ valid: true, errors: [] });
  });

  it('rejects traversal and duplicate settings', () => {
    const invalid = structuredClone(manifest) as unknown as Record<string, unknown>;
    invalid.entry = '../outside.html';
    invalid.settings = [manifest.settings[0], manifest.settings[0]];
    const result = validateModuleManifest(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('entry');
    expect(result.errors.join(' ')).toContain('duplicated');
  });

  it('rejects invalid typed defaults and off-screen bounds', () => {
    const invalid = structuredClone(manifest) as unknown as Record<string, unknown>;
    invalid.defaultBounds = { x: 0.9, y: 0.1, width: 0.3, height: 0.2 };
    invalid.settings = [
      { key: 'enabled', label: 'Enabled', type: 'boolean', default: 'yes' },
      { key: 'mode', label: 'Mode', type: 'select', default: 'missing', options: [{ label: 'A', value: 'a' }] },
    ];

    const result = validateModuleManifest(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('defaultBounds');
    expect(result.errors.join(' ')).toContain('must be boolean');
    expect(result.errors.join(' ')).toContain('must match an option');
  });


  it('accepts protocol v6 telemetry scopes for custom modules', () => {
    const extended = structuredClone(manifest);
    extended.scopes = ['driverAids', 'pit', 'environment', 'motion'];
    expect(validateModuleManifest(extended)).toEqual({ valid: true, errors: [] });
  });

  it('generates settings defaults', () => {
    expect(defaultsFromManifest(manifest)).toEqual({ accent: '#fff', rows: 12 });
  });

  it('keeps normalized bounds on screen', () => {
    expect(sanitizeBounds({ x: 0.9, y: -4, width: 0.4, height: Number.NaN })).toEqual({
      x: 0.6,
      y: 0,
      width: 0.4,
      height: 0.2,
    });
  });
});
