// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

export interface Named {
  id: string;
  name: string;
}

/** Orden alfabético sin distinguir mayúsculas/acentos y con números naturales ("Árbol 2" < "Árbol 10"). */
export function compareNames(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true });
}

/** Favoritos (pins) primero, y dentro de cada grupo orden alfabético. No muta el array original. */
export function sortWithFavorites<T extends Named>(items: readonly T[], favorites: ReadonlySet<string>): T[] {
  return [...items].sort((a, b) => {
    const favDiff = Number(favorites.has(b.id)) - Number(favorites.has(a.id));
    return favDiff !== 0 ? favDiff : compareNames(a, b);
  });
}
