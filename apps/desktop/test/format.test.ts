import { describe, expect, it } from 'vitest';
import { escapeHtml, formatDuration } from '../src/renderer/shared/format';

describe('format helpers', () => {
  it('formats session time', () => {
    expect(formatDuration(125.9)).toBe('2:05');
    expect(formatDuration(0)).toBe('--:--');
  });

  it('escapes untrusted module labels', () => {
    expect(escapeHtml('<img src=x onerror="boom">')).toBe('&lt;img src=x onerror=&quot;boom&quot;&gt;');
  });
});
