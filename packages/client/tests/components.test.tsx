// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromptBar } from '../src/components/PromptBar.js';
import { OutlinerPanel, OutlinerPanelProps } from '../src/components/OutlinerPanel.js';
import { ShortcutsHelp } from '../src/components/ShortcutsHelp.js';
import { FavoriteStar } from '../src/components/FavoriteStar.js';
import { NumberField } from '../src/components/NumberField.js';
import { ProgressOverlay } from '../src/components/ProgressOverlay.js';
import type { GenerationJob } from '@wordsmith/shared';

const noop = () => {};

describe('PromptBar — selector de modo de generación', () => {
  const html = renderToStaticMarkup(<PromptBar onGenerate={noop} isGenerating={false} />);

  it('ofrece los tres modos y "Everything" está activo por defecto', () => {
    expect(html).toContain('Everything');
    expect(html).toContain('Scenery only');
    expect(html).toContain('Objects only');
    expect(html).toMatch(/data-testid="mode-all"[^>]*aria-checked="true"|aria-checked="true"[^>]*data-testid="mode-all"/);
    expect(html).toMatch(/data-testid="mode-objects"[^>]*aria-checked="false"|aria-checked="false"[^>]*data-testid="mode-objects"/);
  });

  it('en modo "all" muestra el selector de cantidad (1–5) y el botón Generate', () => {
    expect(html).toContain('data-testid="count-select"');
    expect((html.match(/<option value="[1-5]"/g) ?? []).length).toBe(5);
    expect(html).toContain('Generate');
  });

  it('deshabilita el selector de modo mientras se genera', () => {
    const busy = renderToStaticMarkup(<PromptBar onGenerate={noop} isGenerating />);
    expect((busy.match(/role="radio"[^>]*disabled=""|disabled=""[^>]*role="radio"/g) ?? []).length).toBe(3);
    expect(busy).toContain('Generating...');
  });
});

describe('OutlinerPanel', () => {
  const base: OutlinerPanelProps = {
    title: 'Isla Pirata',
    objects: [
      { id: 'c', name: 'Zorro', visible: true, locked: false },
      { id: 'a', name: 'árbol 10', visible: true, locked: false },
      { id: 'b', name: 'Árbol 2', visible: false, locked: true },
    ],
    selectedId: null,
    floor: { override: null, level: -1.5 },
    onSelect: noop,
    onFocus: noop,
    onRename: noop,
    onToggleVisible: noop,
    onToggleLocked: noop,
    onDelete: noop,
    onDuplicate: noop,
    onSnapToGround: noop,
    onTransform: noop,
    onSetFloorFromSelected: noop,
    onFloorChange: noop,
  };

  it('lista los objetos en orden alfabético natural (Árbol 2 antes que árbol 10)', () => {
    const html = renderToStaticMarkup(<OutlinerPanel {...base} />);
    const order = ['Árbol 2', 'árbol 10', 'Zorro'].map((n) => html.indexOf(`>${n}<`));
    expect(order.every((i) => i > -1)).toBe(true);
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(html).toContain('Isla Pirata');
  });

  it('sin selección no muestra el inspector; con selección sí, con rotación en grados', () => {
    expect(renderToStaticMarkup(<OutlinerPanel {...base} />)).not.toContain('data-testid="inspector"');

    const html = renderToStaticMarkup(
      <OutlinerPanel
        {...base}
        selectedId="c"
        position={{ x: 7.5, y: -1, z: 3 }}
        rotation={{ x: 0, y: Math.PI / 2, z: 0 }}
        scale={{ x: 1, y: 2, z: 1 }}
      />
    );
    expect(html).toContain('data-testid="inspector"');
    expect(html).toMatch(/data-testid="pos-x"[^>]*value="7\.50"/);
    expect(html).toMatch(/data-testid="rot-y"[^>]*value="90\.0"/);
    expect(html).toMatch(/data-testid="scale-y"[^>]*value="2\.00"/);
  });

  it('un objeto bloqueado tiene los campos del inspector deshabilitados', () => {
    const html = renderToStaticMarkup(
      <OutlinerPanel {...base} selectedId="b" position={{ x: 0, y: 0, z: 0 }} rotation={{ x: 0, y: 0, z: 0 }} scale={{ x: 1, y: 1, z: 1 }} />
    );
    expect(html).toContain('LOCKED');
    expect((html.match(/data-testid="(pos|rot|scale)-[xyz]"[^>]*disabled=""/g) ?? []).length).toBe(9);
  });

  it('indica si el suelo es automático o manual', () => {
    expect(renderToStaticMarkup(<OutlinerPanel {...base} />)).toContain('AUTO');
    const manual = renderToStaticMarkup(<OutlinerPanel {...base} floor={{ override: 0.25, level: -1.5 }} />);
    expect(manual).toContain('MANUAL');
    expect(manual).toMatch(/data-testid="floor-y"[^>]*value="0\.25"/);
  });

  it('con escena vacía invita a añadir objetos', () => {
    expect(renderToStaticMarkup(<OutlinerPanel {...base} objects={[]} />)).toContain('No objects yet');
  });
});

describe('Componentes pequeños', () => {
  it('ShortcutsHelp documenta los atajos estilo Unreal', () => {
    const html = renderToStaticMarkup(<ShortcutsHelp onClose={noop} />);
    for (const text of ['Move gizmo', 'Rotate gizmo', 'Scale gizmo', 'Focus selected', 'Undo', 'Presentation mode']) {
      expect(html).toContain(text);
    }
  });

  it('FavoriteStar refleja el estado fijado con aria-pressed', () => {
    expect(renderToStaticMarkup(<FavoriteStar active onToggle={vi.fn()} />)).toContain('aria-pressed="true"');
    expect(renderToStaticMarkup(<FavoriteStar active={false} onToggle={vi.fn()} />)).toContain('aria-pressed="false"');
  });

  it('NumberField formatea con los decimales pedidos y admite estado deshabilitado', () => {
    const html = renderToStaticMarkup(<NumberField label="X" value={1.23456} decimals={3} onCommit={noop} disabled />);
    expect(html).toContain('value="1.235"');
    expect(html).toContain('disabled=""');
  });

  it('ProgressOverlay solo muestra las fases del modo (objects sin entorno, world sin Tripo)', () => {
    const job = (mode: GenerationJob['mode']): GenerationJob => ({
      id: '123e4567-e89b-12d3-a456-426614174000',
      prompt: 'x',
      mode,
      phase: 'GENERATING_ASSETS',
      progress: 50,
      message: 'En curso',
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const objects = renderToStaticMarkup(<ProgressOverlay job={job('objects')} />);
    expect(objects).not.toContain('Environment (World Labs)');
    expect(objects).toContain('3D Models (Tripo)');
    expect(objects).toContain('current scene stays untouched');

    const world = renderToStaticMarkup(<ProgressOverlay job={job('world')} />);
    expect(world).toContain('Environment (World Labs)');
    expect(world).not.toContain('3D Models (Tripo)');

    const all = renderToStaticMarkup(<ProgressOverlay job={job('all')} />);
    expect(all).toContain('Environment (World Labs)');
    expect(all).toContain('3D Models (Tripo)');
  });
});
