import { describe, expect, it } from "vitest";
import { activation, appearance, pick, prepareGroups, safeUrl, validateGroups } from "./model";
import type { SymbolGroup } from "./model";
import { referenceGroups, resolveLevel, stressGroups } from "../demo/data";

function group(size: number): SymbolGroup {
  return { id: "a", label: "Group", anchor: { x: 0, y: 0, wkid: 4326 }, variant: "images", items: Array.from({ length: size }, (_, i) => ({ id: String(i), label: `Item ${i}`, category: i % 2 ? "odd" : "even" })) };
}

describe("reference behavior and identity", () => {
  it.each([0, 1, 3, 6, 7, 24])("counts and cells for %i items across the exact threshold", size => {
    const groups = [group(size)];
    for (const zoom of [4.499, 4.5]) {
      const result = prepareGroups(groups, zoom, appearance());
      if (size === 0) { expect(result).toEqual([]); continue; }
      const summarized = zoom < 4.5 && size >= 7;
      expect(result[0].counts).toEqual({ total: size, matching: size, displayed: summarized ? 5 : size, hidden: summarized ? size - 5 : 0 });
      expect(result[0].cells.filter(c => c.overflow)).toHaveLength(summarized ? 1 : 0);
      expect(result[0].cells.filter(c => c.item).map(c => c.item!.id)).toEqual(groups[0].items.slice(0, summarized ? 5 : size).map(i => i.id));
    }
  });

  it("recalculates filtering counts and restores every identity without mutating input", () => {
    const g = group(24);
    const before = JSON.stringify(g);
    const filtered = prepareGroups([g], 4, appearance(), i => i.category === "odd")[0];
    expect(filtered.counts).toEqual({ total: 24, matching: 12, displayed: 5, hidden: 7 });
    expect(filtered.cells.filter(c => c.item).map(c => c.item!.id)).toEqual(["1", "3", "5", "7", "9"]);
    expect(prepareGroups([g], 5, appearance())[0].matching).toEqual(g.items);
    expect(JSON.stringify(g)).toBe(before);
  });

  it("keeps each row centered including incomplete rows and never summarizes dots by default", () => {
    const g = group(24); g.variant = "dots";
    const result = prepareGroups([g], 1, appearance())[0];
    expect(result.counts.hidden).toBe(0);
    for (const y of new Set(result.cells.map(c => c.y))) {
      const row = result.cells.filter(c => c.y === y);
      expect(row.reduce((sum, c) => sum + c.x, 0)).toBeCloseTo(0);
    }
  });
});

describe("interaction", () => {
  it("distinguishes gaps, overflow, and exact item hits; last drawn wins overlap", () => {
    const prepared = prepareGroups([group(7)], 4, appearance())[0];
    const cells = prepared.cells.map(cell => ({ cell, prepared, x: cell.x + 100, y: cell.y + 100 }));
    const hit = pick(cells, cells[0].x, cells[0].y)!;
    expect(activation(hit)).toMatchObject({ type: "item", groupId: "a", itemId: "0" });
    const overflow = cells.at(-1)!;
    expect(activation(pick(cells, overflow.x, overflow.y)!)).toMatchObject({ type: "overflow", counts: { matching: 7, hidden: 2 } });
    expect(pick(cells, (cells[0].x + cells[1].x) / 2, cells[0].y)).toBeUndefined();
    const top = { ...hit, prepared: { ...prepared, group: { ...prepared.group, id: "top" } } };
    expect(activation(pick([hit, top], hit.x, hit.y)!)).toMatchObject({ groupId: "top" });
  });

  it("rejects unsupported coordinates and duplicate identities", () => {
    expect(() => validateGroups([{ ...group(1), anchor: { x: 181, y: 0, wkid: 4326 } }])).toThrow();
    expect(() => validateGroups([group(1), group(2)])).toThrow();
    const g = group(2); g.items = [g.items[0], g.items[0]];
    expect(() => validateGroups([g])).toThrow();
    expect(() => appearance({ summaryVisible: 8 })).toThrow();
    expect(() => validateGroups([{ ...group(4), visibleItems: 1.5 }])).toThrow();
    expect(() => validateGroups([{ ...group(4), visibleItems: 0 }])).toThrow();
  });

  it("honors explicit per-group item budgets across zoom changes and filtering", () => {
    const source = { ...group(24), visibleItems: 9 };
    for (const zoom of [1, 15]) {
      const prepared = prepareGroups([source], zoom, appearance())[0];
      expect(prepared.counts).toEqual({ total: 24, matching: 24, displayed: 9, hidden: 15 });
      expect(activation({ prepared, cell: prepared.cells.at(-1)!, x: 0, y: 0 })).toMatchObject({ type: "overflow", counts: { hidden: 15 } });
      const filtered = prepareGroups([source], zoom, appearance(), i => Number(i.id) < 3)[0];
      expect(filtered.counts).toEqual({ total: 24, matching: 3, displayed: 3, hidden: 0 });
      expect(filtered.cells.every(c => !c.overflow)).toBe(true);
    }
  });

  it("blocks executable URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeUrl("https://example.org/")).toBe("https://example.org/");
  });
});

describe("demo profiles", () => {
  it("provides exact validation workload and valid independent identities", () => {
    const stress = stressGroups();
    expect(stress).toHaveLength(470);
    expect(stress.reduce((sum, g) => sum + g.items.length, 0)).toBe(1283);
    expect(() => validateGroups(stress)).not.toThrow();
    expect(referenceGroups().slice(0, 6).map(g => g.items.length)).toEqual([0, 1, 3, 6, 7, 24]);
  });
  it("keeps fixed grouping and avoids oscillation around automatic zoom threshold", () => {
    expect(resolveLevel("auto", 7.1, "region")).toBe("region");
    expect(resolveLevel("auto", 7.1, "locality")).toBe("locality");
    expect(resolveLevel("auto", 7.2, "region")).toBe("locality");
    expect(resolveLevel("auto", 6.8, "locality")).toBe("region");
    expect(resolveLevel("region", 15, "locality")).toBe("region");
  });
});
