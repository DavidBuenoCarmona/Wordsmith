// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React from 'react';
import { Star } from 'lucide-react';

interface FavoriteStarProps {
  active: boolean;
  onToggle: () => void;
}

/** Botón de pin/favorito reutilizado por los selectores de mundos y modelos. */
export const FavoriteStar: React.FC<FavoriteStarProps> = ({ active, onToggle }) => (
  <button
    type="button"
    data-testid="favorite-star"
    aria-pressed={active}
    title={active ? 'Unpin from top' : 'Pin to top'}
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    className="shrink-0 p-1 rounded-lg hover:bg-slate-700/70 transition-colors"
  >
    <Star className={`w-3.5 h-3.5 ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-500 hover:text-amber-300'}`} />
  </button>
);
