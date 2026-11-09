import { prepareGroups } from "../layer/model";
import type { Appearance, ItemFilter, SymbolGroup } from "../layer/model";

export interface BoundaryGeometry { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] }
export interface BoundaryCollection { features: { properties: { id: string; name: string; anchorX: number; anchorY: number }; geometry: BoundaryGeometry }[] }
export function fittingBoundary(group: SymbolGroup, regions: BoundaryCollection, localities: BoundaryCollection, mode: "region" | "group" | "none"): BoundaryCollection["features"][number] | undefined {
  if (mode === "none") return;
  if (mode === "region") return regions.features.find(f => f.properties.id === group.territoryId);
  return group.id.startsWith("region:")
    ? regions.features.find(f => f.properties.id === group.id.slice("region:".length))
    : localities.features.find(f => f.properties.id === group.id.slice("locality:municipality:".length));
}
export function inBoundary(x: number, y: number, geometry: BoundaryGeometry): boolean {
  function ringContains(ring: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates as number[][][]] : geometry.coordinates as number[][][][];
  return polygons.some(p => ringContains(p[0]) && !p.slice(1).some(ringContains));
}

interface Rect { left: number; top: number; right: number; bottom: number }
export interface PresentationBudget {
  maxVisibleItems: number;
  minVisibleImages: number;
}
export const defaultPresentationBudget: PresentationBudget = { maxVisibleItems: 24, minVisibleImages: 3 };
export function adaptivePresentation(
  groups: readonly SymbolGroup[], zoom: number, settings: Readonly<Appearance>, filter: ItemFilter | undefined,
  toScreen: (group: SymbolGroup) => { x: number; y: number } | undefined,
  insideTerritory: (group: SymbolGroup, x: number, y: number) => boolean,
  budget: Readonly<PresentationBudget> = defaultPresentationBudget,
): SymbolGroup[] {
  const occupied: Rect[] = [];
  return groups.map(group => {
    const screen = toScreen(group);
    const matching = group.items.filter(item => !filter || filter(item, group)).length;
    const fallback: SymbolGroup = matching < settings.countThreshold
      ? { ...group, variant: "dots", presentation: "items", visibleItems: Math.max(1, matching) }
      : { ...group, presentation: "count", visibleItems: undefined };
    if (!screen) return fallback;
    // A bounded search maximizes visible logos independently for each territory.
    // Explicit budgets prevent the layer's reference zoom profile from truncating them again.
    const candidates: SymbolGroup[] = [];
    if (matching <= budget.maxVisibleItems) candidates.push({ ...group, variant: "images", presentation: "items", visibleItems: Math.max(1, matching) });
    for (let count = Math.min(budget.maxVisibleItems, matching - 1); count >= budget.minVisibleImages; count--) {
      candidates.push({ ...group, variant: "images", presentation: "items", visibleItems: count });
    }
    if (matching <= budget.maxVisibleItems) candidates.push({ ...group, variant: "dots", presentation: "items", visibleItems: Math.max(1, matching) });
    for (const candidate of candidates) {
      const prepared = prepareGroups([candidate], zoom, settings, filter)[0];
      if (!prepared) return candidate;
      const rect: Rect = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
      let fits = true;
      for (const cell of prepared.cells) {
        const left = screen.x + cell.x - cell.size / 2 - 2, right = screen.x + cell.x + cell.size / 2 + 2;
        const top = screen.y + cell.y - cell.size / 2 - 2, bottom = screen.y + cell.y + cell.size / 2 + 2;
        rect.left = Math.min(rect.left, left); rect.right = Math.max(rect.right, right); rect.top = Math.min(rect.top, top); rect.bottom = Math.max(rect.bottom, bottom);
        if (![ [left, top], [right, top], [left, bottom], [right, bottom], [screen.x + cell.x, screen.y + cell.y] ].every(([x, y]) => insideTerritory(group, x, y))) { fits = false; break; }
      }
      // Reserve the caption as well as the marker arrangement for neighbor overlap.
      const labelWidth = settings.showLabels ? Math.min(150, group.label.length * 6 + 16) : 0;
      rect.left = Math.min(rect.left, screen.x - labelWidth / 2); rect.right = Math.max(rect.right, screen.x + labelWidth / 2); rect.bottom += settings.showLabels ? 23 : 0;
      if (fits && !occupied.some(o => rect.left < o.right + 4 && rect.right > o.left - 4 && rect.top < o.bottom + 4 && rect.bottom > o.top - 4)) {
        occupied.push(rect); return candidate;
      }
    }
    const prepared = prepareGroups([fallback], zoom, settings, filter)[0];
    if (prepared) for (const cell of prepared.cells) {
      occupied.push({ left: screen.x + cell.x - cell.size / 2, right: screen.x + cell.x + cell.size / 2, top: screen.y + cell.y - cell.size / 2, bottom: screen.y + cell.y + cell.size / 2 });
    }
    return fallback;
  });
}
