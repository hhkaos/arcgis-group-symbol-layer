import { expect, it } from "vitest";
import { appearance, prepareGroups } from "../layer/model";
import type { SymbolGroup } from "../layer/model";
import { adaptivePresentation, inBoundary } from "./presentation";
import { resolveDemoOptions } from "./config";

const group: SymbolGroup = { id: "region:a", label: "Territory", variant: "images", anchor: { x: 0, y: 0, wkid: 4326 }, items: [{ id: "1", label: "Item", category: "a" }] };
const screen = () => ({ x: 100, y: 100 });
it("uses images when they fit, colored dots in less space, and a group counter when neither fits", () => {
  const a = appearance();
  const image = adaptivePresentation([group], 4, a, undefined, screen, () => true)[0];
  expect(image).toMatchObject({ variant: "images", presentation: "items" });
  const dot = adaptivePresentation([group], 4, a, undefined, screen, (_g, x, y) => Math.abs(x - 100) <= 10 && Math.abs(y - 100) <= 10)[0];
  expect(dot).toMatchObject({ variant: "dots", presentation: "items" });
  const many = { ...group, items: Array.from({ length: 3 }, (_, i) => ({ ...group.items[0], id: String(i) })) };
  const counter = adaptivePresentation([many], 4, a, undefined, screen, () => false)[0];
  const prepared = prepareGroups([counter], 4, a)[0];
  expect(prepared.counts).toEqual({ total: 3, matching: 3, displayed: 0, hidden: 3 });
  expect(prepared.cells).toHaveLength(1);
  expect(prepared.cells[0]).toMatchObject({ overflow: true, text: "3" });
});

it.each([1, 2])("keeps %i individual dots instead of a counter even at a cramped boundary", count => {
  const a = appearance();
  const source = { ...group, items: Array.from({ length: count }, (_, i) => ({ ...group.items[0], id: String(i) })) };
  const adapted = adaptivePresentation([source], 4, a, undefined, screen, () => false)[0];
  expect(adapted).toMatchObject({ variant: "dots", presentation: "items" });
  for (const candidate of [adapted, { ...source, presentation: "count" as const }]) {
    const prepared = prepareGroups([candidate], 4, a)[0];
    expect(prepared.group.variant).toBe("dots");
    expect(prepared.counts.displayed).toBe(count);
    expect(prepared.cells.every(c => c.item && !c.overflow && !c.text)).toBe(true);
  }
});

it.each([3, 12])("chooses full logos, the largest fitting logo summary, all dots, or a count at the same zoom %i", zoom => {
  const a = appearance({ detailZoom: 9, overviewScale: 1, dotSize: 8, gap: 3 });
  const radii = [80, 54, 24, 5];
  const sources = radii.map((_, i) => ({ ...group, id: String(i), items: Array.from({ length: 12 }, (_, j) => ({ ...group.items[0], id: String(j) })) }));
  const position = (g: SymbolGroup) => ({ x: 100 + Number(g.id) * 300, y: 100 });
  const adapted = adaptivePresentation(sources, zoom, a, undefined, position, (g, x, y) => Math.abs(x - position(g).x) <= radii[Number(g.id)] && Math.abs(y - 100) <= radii[Number(g.id)]);
  const prepared = prepareGroups(adapted, zoom, a);
  expect(prepared.map(p => p.counts.displayed)).toEqual([12, 8, 12, 0]);
  expect(prepared.map(p => p.group.variant)).toEqual(["images", "images", "dots", "images"]);
  expect(prepared[1].cells.at(-1)?.overflow).toBe(true);
  expect(prepared[1].counts.hidden).toBe(4);
  expect(prepared[2].cells.every(c => !c.overflow)).toBe(true);
  expect(prepared[3].cells[0].text).toBe("12");
});

it("limits density, uses the developer budget, and falls back to a counter for too many dots", () => {
  const a = appearance();
  const source = { ...group, items: Array.from({ length: 30 }, (_, i) => ({ ...group.items[0], id: String(i) })) };
  const budget = resolveDemoOptions({ presentation: { maxVisibleItems: 8, minVisibleImages: 3 } }).presentation;
  const images = adaptivePresentation([source], 12, a, undefined, screen, () => true, budget)[0];
  expect(prepareGroups([images], 12, a)[0].counts).toMatchObject({ displayed: 8, hidden: 22 });
  const counter = adaptivePresentation([source], 12, a, undefined, screen, (_g, x, y) => Math.abs(x - 100) < 23 && Math.abs(y - 100) < 23, budget)[0];
  expect(counter.presentation).toBe("count");
  expect(() => resolveDemoOptions({ presentation: { maxVisibleItems: 101 } })).toThrow();
  expect(() => resolveDemoOptions({ presentation: { maxVisibleItems: 4, minVisibleImages: 5 } })).toThrow();
});

it("does not overlap neighboring image compositions and produces stable repeated decisions", () => {
  const a = appearance({ overviewScale: 1, gap: 3 });
  const sources = [group, { ...group, id: "neighbor" }];
  const position = (g: SymbolGroup) => ({ x: g.id === "neighbor" ? 130 : 100, y: 100 });
  const first = adaptivePresentation(sources, 6, a, undefined, position, () => true);
  expect(first.map(g => g.variant)).toEqual(["images", "dots"]);
  expect(adaptivePresentation(first, 6, a, undefined, position, () => true)).toEqual(first);
});

it("recomputes the available-space decision after filtering without changing source membership", () => {
  const many = { ...group, items: Array.from({ length: 24 }, (_, i) => ({ id: String(i), label: `Item ${i}`, category: "a" })) };
  const original = JSON.stringify(many);
  const a = appearance();
  const inside = (_g: SymbolGroup, x: number, y: number) => Math.abs(x - 100) < 20 && Math.abs(y - 100) < 20;
  const filtered = adaptivePresentation([many], 4, a, i => i.id === "0", screen, inside)[0];
  expect(filtered).toMatchObject({ variant: "images", presentation: "items" });
  expect(JSON.stringify(many)).toBe(original);
  expect(filtered.items).toHaveLength(24);
});

it("respects holes and separate islands when checking a territorial footprint", () => {
  const geometry = { type: "Polygon" as const, coordinates: [[[0,0],[10,0],[10,10],[0,10],[0,0]], [[4,4],[6,4],[6,6],[4,6],[4,4]]] };
  expect(inBoundary(1, 1, geometry)).toBe(true);
  expect(inBoundary(5, 5, geometry)).toBe(false);
  expect(inBoundary(20, 20, geometry)).toBe(false);
});
