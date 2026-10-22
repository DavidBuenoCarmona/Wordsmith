// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onCommit: (value: number) => void;
  decimals?: number;
  step?: number;
  disabled?: boolean;
  testId?: string;
}

/**
 * Campo numérico que se confirma con Enter o al perder el foco.
 * Mientras se edita no lo pisa el valor en vivo del gizmo.
 */
export const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  onCommit,
  decimals = 2,
  step = 0.1,
  disabled = false,
  testId,
}) => {
  const format = (v: number | undefined) => (typeof v === 'number' ? v.toFixed(decimals) : '');
  const [text, setText] = useState<string>(format(value));
  const [editing, setEditing] = useState<boolean>(false);
  // Evita confirmar dos veces (Enter + blur) el mismo valor
  const pendingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!editing) setText(format(value));
  }, [value, editing, decimals]);

  const startEditing = () => {
    pendingRef.current = true;
    setEditing(true);
  };

  const commit = () => {
    if (!pendingRef.current) return;
    pendingRef.current = false;

    const parsed = Number(text.replace(',', '.'));
    if (text.trim() !== '' && Number.isFinite(parsed)) {
      onCommit(parsed);
    }
    setEditing(false);
    setText(format(value));
  };

  const cancel = () => {
    pendingRef.current = false;
    setEditing(false);
    setText(format(value));
  };

  return (
    <label className="flex items-center gap-1 bg-slate-950/70 border border-slate-700/60 rounded-lg px-1.5 py-1 focus-within:border-indigo-500/70">
      <span className="text-[10px] font-bold text-slate-500 w-3 shrink-0">{label}</span>
      <input
        data-testid={testId}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={text}
        step={step}
        onFocus={(e) => {
          startEditing();
          e.currentTarget.select();
        }}
        onChange={(e) => {
          startEditing();
          setText(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            cancel();
            e.currentTarget.blur();
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            startEditing();
            const base = Number(text.replace(',', '.'));
            const next = (Number.isFinite(base) ? base : value ?? 0) + (e.key === 'ArrowUp' ? step : -step);
            setText(next.toFixed(decimals));
          }
        }}
        className="w-full min-w-0 bg-transparent text-[11px] font-mono text-slate-200 outline-none disabled:opacity-40"
      />
    </label>
  );
};
