// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  createProfile,
  parseProfile,
  validateCalibration,
  validateRenderOptions,
  DEFAULT_CALIBRATION,
  DEFAULT_RENDER_OPTIONS,
  logicalView,
  renderedView,
} from 'jupiter-interlace-sdk';

describe('JupiterSR Interlace SDK Integration', () => {
  it('debe contener los valores de calibración óptica por defecto estándar', () => {
    expect(DEFAULT_CALIBRATION.pitch).toBeCloseTo(0.27777, 4);
    expect(DEFAULT_CALIBRATION.tan).toBe(10);
    expect(DEFAULT_CALIBRATION.offset).toBe(2);
    expect(DEFAULT_CALIBRATION.order).toBe('forward');
    expect(DEFAULT_CALIBRATION.subpixelOrder).toBe('RGB');
  });

  it('debe validar y crear un perfil completo para display autoestereoscópico', () => {
    const profile = createProfile(
      { pitch: 0.28, tan: 10, offset: 1.5 },
      { views: 9, viewSpacing: 0.008, focusDistance: 3.5, mode: 'interlaced' }
    );

    expect(profile.schemaVersion).toBe(1);
    expect(profile.algorithm).toBe('jupiter-30-v1');
    expect(profile.calibration.pitch).toBe(0.28);
    expect(profile.calibration.offset).toBe(1.5);
    expect(profile.render.views).toBe(9);
    expect(profile.render.viewSpacing).toBe(0.008);
    expect(profile.render.mode).toBe('interlaced');
  });

  it('debe serializar y deserializar perfiles JSON de JupiterSR correctamente', () => {
    const initialProfile = createProfile(
      { pitch: 0.27777, tan: 12, offset: 2.2 },
      { views: 30, viewWidth: 720, viewSpacing: 0.012, focusDistance: 4, mode: 'interlaced' }
    );

    const json = JSON.stringify(initialProfile);
    const parsed = parseProfile(json);

    expect(parsed.calibration.tan).toBe(12);
    expect(parsed.calibration.offset).toBe(2.2);
    expect(parsed.render.views).toBe(30);
    expect(parsed.render.viewWidth).toBe(720);
    expect(parsed.render.mode).toBe('interlaced');
  });

  it('debe calcular mapeo de vistas lógicas y renderizadas con precisión', () => {
    // tan=0 selecciona la vista central 14
    const centerView = logicalView(50, { ...DEFAULT_CALIBRATION, tan: 0 });
    expect(centerView).toBe(14);

    // Mapeo de vista renderizada para 9 vistas físicas
    const rendered = renderedView(14, 9);
    expect(rendered).toBeGreaterThanOrEqual(0);
    expect(rendered).toBeLessThanOrEqual(8);
  });

  it('debe rechazar parámetros de calibración inválidos o infinitos', () => {
    expect(() => validateCalibration({ ...DEFAULT_CALIBRATION, pitch: NaN })).toThrow();
    expect(() => validateRenderOptions({ ...DEFAULT_RENDER_OPTIONS, views: 0 })).toThrow();
    expect(() => validateRenderOptions({ ...DEFAULT_RENDER_OPTIONS, views: 35 })).toThrow();
  });
});
