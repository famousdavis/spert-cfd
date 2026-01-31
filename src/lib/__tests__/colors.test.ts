import { describe, it, expect } from 'vitest';
import { PRESET_COLORS, getContrastColor } from '../colors';

describe('PRESET_COLORS', () => {
  it('has 12 colors', () => {
    expect(PRESET_COLORS).toHaveLength(12);
  });

  it('all are valid hex colors', () => {
    for (const color of PRESET_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('getContrastColor', () => {
  it('returns white for dark backgrounds', () => {
    expect(getContrastColor('#000000')).toBe('#ffffff');
    expect(getContrastColor('#333333')).toBe('#ffffff');
  });

  it('returns black for light backgrounds', () => {
    expect(getContrastColor('#ffffff')).toBe('#000000');
    expect(getContrastColor('#f0f0f0')).toBe('#000000');
  });

  it('returns appropriate contrast for preset colors', () => {
    // Each preset color should return a valid contrast value
    for (const color of PRESET_COLORS) {
      const contrast = getContrastColor(color);
      expect(['#ffffff', '#000000']).toContain(contrast);
    }
  });
});
