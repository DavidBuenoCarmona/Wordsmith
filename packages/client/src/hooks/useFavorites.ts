// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

export type FavoritesKind = 'worlds' | 'models';

/** Pins persistentes (servidor: storage/favorites.json) de mundos o modelos. */
export function useFavorites(kind: FavoritesKind) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // Copia síncrona del estado: el efecto secundario (PUT) no debe vivir dentro de un updater de setState
  const currentRef = useRef<Set<string>>(favorites);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/storage/favorites/${kind}`)
      .then((res) => (res.ok ? res.json() : { ids: [] }))
      .then((data: { ids?: string[] }) => {
        if (cancelled) return;
        const loaded = new Set(data.ids ?? []);
        currentRef.current = loaded;
        setFavorites(loaded);
      })
      .catch(() => {
        // Sin servidor los pins simplemente no se cargan
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const toggleFavorite = useCallback(
    (id: string) => {
      const next = new Set(currentRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      currentRef.current = next;
      setFavorites(next);

      fetch(`/api/storage/favorites/${kind}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(next) }),
      }).catch(() => {
        // El pin queda en memoria aunque falle la persistencia
      });
    },
    [kind]
  );

  return { favorites, toggleFavorite };
}
