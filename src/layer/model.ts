export interface GroupItem {
  id: string;
  sourceId?: string;
  label: string;
  category: string;
  image?: string;
  imageFit?: "cover" | "contain";
  description?: string;
  url?: string;
}

export interface SymbolGroup {
  id: string;
  label: string;
  anchor: { x: number; y: number; wkid: 4326 | 3857 };
  variant: "dots" | "images";
  items: readonly GroupItem[];
  territoryId?: string;
  presentation?: "items" | "count";
  /** Explicit per-group item budget after filtering; overrides zoom-based overflow. */
  visibleItems?: number;
}

export interface Appearance {
  colors: Record<string, string>;
  defaultColor: string;
  imageSize: number;
  dotSize: number;
  overviewScale: number;
  gap: number;
  maxColumns: number;
  detailZoom: number;
  summaryThreshold: number;
  summaryVisible: number;
  summarizeDots: boolean;
  attenuation: number;
  overflowColor: string;
  showLabels: boolean;
  countSize: number;
  countThreshold: number;
  declutterCounts: boolean;
}

export const defaults: Appearance = {
  colors: {}, defaultColor: "#64748b", imageSize: 32, dotSize: 12, overviewScale: 0.9,
  gap: 5, maxColumns: 6, detailZoom: 4.5,
  summaryThreshold: 7, summaryVisible: 5, summarizeDots: false,
  attenuation: 0.22, overflowColor: "#173d46",
  showLabels: false,
  countSize: 24, countThreshold: 3, declutterCounts: false,
};

export interface Counts { total: number; matching: number; displayed: number; hidden: number }
export interface PreparedGroup {
  group: SymbolGroup;
  matching: readonly GroupItem[];
  counts: Counts;
  cells: Cell[];
}
export interface Cell {
  x: number; y: number; size: number;
  item?: GroupItem;
  overflow: boolean;
  text?: string;
}
export type ItemFilter = (item: GroupItem, group: SymbolGroup) => boolean;
export type Activation =
  | { type: "item"; groupId: string; itemId: string; sourceId?: string; group: SymbolGroup; item: GroupItem; counts: Counts }
  | { type: "overflow"; groupId: string; group: SymbolGroup; counts: Counts };

export function appearance(options: Partial<Appearance> = {}): Appearance {
  const a = { ...defaults, ...options, colors: { ...(options.colors ?? {}) } };
  const bounded: [keyof Appearance, number, number][] = [
    ["imageSize", 16, 72], ["dotSize", 6, 36], ["gap", 0, 24],
    ["overviewScale", 0.5, 1],
    ["countSize", 16, 48],
    ["countThreshold", 2, 10000],
    ["maxColumns", 1, 20], ["detailZoom", 0, 24], ["summaryThreshold", 2, 10000],
    ["summaryVisible", 1, 9999], ["attenuation", 0, 1],
  ];
  for (const [key, min, max] of bounded) {
    const value = a[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid appearance.${key}: expected ${min}–${max}`);
  }
  for (const key of ["maxColumns", "summaryThreshold", "summaryVisible", "countThreshold"] as const) {
    if (!Number.isInteger(a[key])) throw new Error(`${key} must be an integer`);
  }
  if (a.summaryVisible >= a.summaryThreshold) throw new Error("summaryVisible must be smaller than summaryThreshold");
  return a;
}

export function validateGroups(groups: readonly SymbolGroup[]): void {
  const ids = new Set<string>();
  for (const g of groups) {
    if (!g.id || ids.has(g.id)) throw new Error(`Missing or duplicate group id: ${g.id}`);
    ids.add(g.id);
    if (g.variant !== "dots" && g.variant !== "images") throw new Error(`Invalid variant in ${g.id}`);
    if (g.presentation !== undefined && !["items", "count"].includes(g.presentation)) throw new Error(`Invalid presentation in ${g.id}`);
    if (g.visibleItems !== undefined && (!Number.isSafeInteger(g.visibleItems) || g.visibleItems < 1)) throw new Error(`Invalid visibleItems in ${g.id}`);
    const { x, y, wkid } = g.anchor;
    if (![4326, 3857].includes(wkid) || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Invalid or unsupported anchor in ${g.id}`);
    if (wkid === 4326 && (Math.abs(x) > 180 || Math.abs(y) > 85.05112878)) throw new Error(`Anchor outside supported Web Mercator domain in ${g.id}`);
    if (wkid === 3857 && (Math.abs(x) > 20037508.343 || Math.abs(y) > 20037508.343)) throw new Error(`Web Mercator anchor out of bounds in ${g.id}`);
    const itemIds = new Set<string>();
    for (const item of g.items) {
      if (!item.id || itemIds.has(item.id)) throw new Error(`Missing or duplicate item id in ${g.id}`);
      itemIds.add(item.id);
    }
  }
}

export function prepareGroups(groups: readonly SymbolGroup[], zoom: number, a: Appearance, filter?: ItemFilter): PreparedGroup[] {
  const prepared: PreparedGroup[] = [];
  for (const group of groups) {
    const matching = group.items.filter(item => !filter || filter(item, group));
    if (!matching.length) continue;
    const countOnly = group.presentation === "count" && matching.length >= a.countThreshold;
    // Small groups retain individual identity even when a counter was requested.
    const variant = group.presentation === "count" && !countOnly ? "dots" : group.variant;
    const limit = group.visibleItems ?? (zoom < a.detailZoom && matching.length >= a.summaryThreshold && (variant === "images" || a.summarizeDots) ? a.summaryVisible : matching.length);
    const summarized = countOnly || matching.length > limit;
    const displayed = countOnly ? [] : matching.slice(0, limit);
    const count = displayed.length + (summarized ? 1 : 0);
    const columns = Math.min(a.maxColumns, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);
    const scale = zoom < a.detailZoom ? a.overviewScale : 1;
    const size = (countOnly ? a.countSize : variant === "dots" ? a.dotSize : a.imageSize) * scale;
    const pitch = size + a.gap * scale;
    const cells: Cell[] = Array.from({ length: count }, (_, index) => {
      const row = Math.floor(index / columns), column = index % columns;
      const rowCount = Math.min(columns, count - row * columns);
      return { x: (column - (rowCount - 1) / 2) * pitch, y: (row - (rows - 1) / 2) * pitch, size, item: displayed[index], overflow: index >= displayed.length, text: countOnly ? String(matching.length) : undefined };
    });
    prepared.push({ group: group.presentation === "count" && !countOnly ? { ...group, variant, presentation: "items" } : group, matching, cells, counts: { total: group.items.length, matching: matching.length, displayed: displayed.length, hidden: matching.length - displayed.length } });
  }
  return prepared;
}

export interface ScreenCell { x: number; y: number; cell: Cell; prepared: PreparedGroup }
export function pick(cells: readonly ScreenCell[], x: number, y: number): ScreenCell | undefined {
  // Last supplied group/item draws on top. Hit area is exactly the visible circle.
  for (let i = cells.length - 1; i >= 0; i--) {
    const cell = cells[i];
    if (Math.hypot(x - cell.x, y - cell.y) <= cell.cell.size / 2) return cell;
  }
}

export function activation(hit: ScreenCell): Activation {
  const { group, counts } = hit.prepared;
  const item = hit.cell.item;
  return item
    ? { type: "item", groupId: group.id, itemId: item.id, sourceId: item.sourceId, group, item, counts }
    : { type: "overflow", groupId: group.id, group, counts };
}

export function safeUrl(value?: string): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value, globalThis.location?.href ?? "https://example.invalid/");
    if (["http:", "https:"].includes(url.protocol)) return url.href;
  } catch { /* Invalid source content is not navigable. */ }
}
