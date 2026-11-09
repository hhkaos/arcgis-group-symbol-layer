import { afterEach, expect, it, vi } from "vitest";
import { readSharedState, restoredScale, sharedStateUrl, UrlHistory } from "./urlState";
import type { HistoryPort, SharedState } from "./urlState";

const initial = (): SharedState => ({ ...readSharedState(new URL("https://example.org/demo/")), view: { longitude: -3.7, latitude: 40.4, scale: 500000, rotation: 37, width: 1024, height: 700 } });
class MemoryHistory implements HistoryPort {
  entries = [new URL("https://example.org/demo/?campaign=example#map")];
  index = 0;
  listener?: () => void;
  currentUrl = () => new URL(this.entries[this.index]);
  write(url: URL, replace: boolean): void {
    if (replace) this.entries[this.index] = new URL(url);
    else { this.entries.splice(this.index + 1); this.entries.push(new URL(url)); this.index++; }
  }
  listen(callback: () => void): () => void { this.listener = callback; return () => { this.listener = undefined; }; }
  travel(index: number): void { this.index = index; this.listener?.(); }
}
afterEach(() => vi.useRealTimers());

it("round-trips all filters, explicit all-status, locale, grouping, and rotated camera", () => {
  const state: SharedState = { ...initial(), language: "es", search: "C++ · diseño & datos", category: "conference", status: "", region: "region:1", province: "province:1", group: "locality:one", visibleOnly: false, dataset: "stress", grouping: "locality", level: "locality", variant: "dots" };
  const url = sharedStateUrl(new URL("https://example.org/repo/?campaign=demo#map"), state);
  const restored = readSharedState(url);
  // Fixed grouping determines the effective level; the level parameter only preserves auto hysteresis.
  expect({ ...restored, level: state.level }).toEqual(state);
  expect(url.pathname).toBe("/repo/"); expect(url.hash).toBe("#map");
  expect(url.searchParams.get("campaign")).toBe("demo");
  expect(url.searchParams.get("status")).toBe("all");
  expect(sharedStateUrl(url, state).href).toBe(url.href);
});

it("preserves the resolved auto level and prioritizes a URL locale over the browser preference", () => {
  expect(readSharedState(sharedStateUrl(new URL("https://example.org/"), { ...initial(), level: "locality", language: "en" }), "es")).toMatchObject({ language: "en", grouping: "auto", level: "locality" });
  expect(readSharedState(new URL("https://example.org/"), "es").language).toBe("es");
});

it.each(["NaN,40,100,0,100,100", "0,91,100,0,100,100", "0,40,-1,0,100,100", "0,40,1,0,0,100", "0,40,1,0,100,Infinity", "0,40,1,0,100", "0,40,1,,100,100"])("ignores malformed view %s without losing valid filters", view => {
  const url = new URL("https://example.org/?lang=es&q=meetup&status=invalid&dataset=invalid&grouping=invalid&variant=invalid");
  url.searchParams.set("view", view);
  expect(readSharedState(url)).toMatchObject({ language: "es", search: "meetup", status: "active", dataset: "communities", grouping: "auto", variant: "mixed" });
  expect(readSharedState(url).view).toBeUndefined();
});

it("bounds input sizes and never serializes a province without its parent region", () => {
  const url = new URL("https://example.org/"); url.searchParams.set("q", "x".repeat(1000)); url.searchParams.set("region", "r".repeat(1000));
  expect(readSharedState(url).search).toHaveLength(500); expect(readSharedState(url).region).toHaveLength(256);
  expect(sharedStateUrl(url, { ...initial(), province: "orphan" }).searchParams.has("province")).toBe(false);
});

it("preserves the saved screen footprint on same-sized, proportional, and narrow screens", () => {
  const view = initial().view!;
  expect(restoredScale(view, 1024, 700)).toBe(view.scale);
  expect(restoredScale(view, 2048, 1400)).toBe(view.scale / 2);
  const scale = restoredScale(view, 390, 600);
  expect(scale * 390).toBeGreaterThanOrEqual(view.scale * view.width);
  expect(scale * 600).toBeGreaterThanOrEqual(view.scale * view.height);
});

it("coalesces navigation, deduplicates states, and cancels pending changes on Back/Forward", async () => {
  vi.useFakeTimers(); const port = new MemoryHistory(); let state = initial();
  const apply = vi.fn(async (next: SharedState) => { state = next; });
  const sync = new UrlHistory(() => state, apply, () => true, port);
  expect(port.entries).toHaveLength(1);
  state = { ...state, category: "conference" }; sync.flush();
  state = { ...state, language: "es" }; sync.schedule(); sync.schedule();
  await vi.advanceTimersByTimeAsync(450);
  expect(port.entries).toHaveLength(3);
  sync.flush(); expect(port.entries).toHaveLength(3);
  state = { ...state, search: "pending" }; sync.schedule();
  port.travel(1); await vi.advanceTimersByTimeAsync(1000);
  expect(state).toMatchObject({ category: "conference", language: "en", search: "" });
  expect(port.entries).toHaveLength(3);
  port.travel(2); await vi.advanceTimersByTimeAsync(0);
  expect(state.language).toBe("es"); expect(port.entries).toHaveLength(3);
  sync.destroy(); expect(port.listener).toBeUndefined();
});

it("keeps an entire search edit in one entry and creates another only for a new edit", async () => {
  vi.useFakeTimers(); const port = new MemoryHistory(); let state = initial();
  const sync = new UrlHistory(() => state, async next => { state = next; }, () => true, port);
  for (const search of ["M", "Mo", "Morcilla"]) {
    state = { ...state, search }; sync.updateSearch();
    await vi.advanceTimersByTimeAsync(2000);
  }
  expect(port.entries).toHaveLength(2); expect(readSharedState(port.currentUrl()).search).toBe("Morcilla");
  sync.finishSearch(); state = { ...state, search: "Zaragoza" }; sync.updateSearch(); sync.finishSearch();
  expect(port.entries).toHaveLength(3);
  port.travel(1); await vi.advanceTimersByTimeAsync(0);
  expect(state.search).toBe("Morcilla"); sync.destroy();
});

it("waits for navigation to finish before capturing its final camera", async () => {
  vi.useFakeTimers(); const port = new MemoryHistory(); let state = initial(); let stationary = true;
  const sync = new UrlHistory(() => state, async next => { state = next; }, () => stationary, port);
  stationary = false; state = { ...state, region: "region:1" }; sync.flush();
  await vi.advanceTimersByTimeAsync(1000); expect(port.entries).toHaveLength(1);
  state.view = { ...state.view!, longitude: -5.9 }; stationary = true;
  await vi.advanceTimersByTimeAsync(450);
  expect(port.entries).toHaveLength(2); expect(readSharedState(port.currentUrl()).view?.longitude).toBe(-5.9);
  sync.destroy();
});

it("replaces viewport-size-only changes without adding a Back checkpoint", () => {
  const port = new MemoryHistory(); let state = initial();
  const sync = new UrlHistory(() => state, async next => { state = next; }, () => true, port);
  state = { ...state, view: { ...state.view!, width: 700, height: 500 } }; sync.flush();
  expect(port.entries).toHaveLength(1);
  state = { ...state, language: "es" }; sync.flush();
  expect(port.entries).toHaveLength(2);
  state = { ...state, view: { ...state.view!, height: 450 } }; sync.flush();
  expect(port.entries).toHaveLength(2); sync.destroy();
});

it("debounces rapid search replacements but makes the first change immediately available to Back", async () => {
  vi.useFakeTimers(); const port = new MemoryHistory(); let state = initial();
  const sync = new UrlHistory(() => state, async next => { state = next; }, () => true, port);
  state = { ...state, search: "A" }; sync.updateSearch();
  expect(port.entries).toHaveLength(2); expect(readSharedState(port.currentUrl()).search).toBe("A");
  for (const search of ["Ag", "Agi", "Agile"]) { state = { ...state, search }; sync.updateSearch(); }
  expect(readSharedState(port.currentUrl()).search).toBe("A");
  await vi.advanceTimersByTimeAsync(450);
  expect(port.entries).toHaveLength(2); expect(readSharedState(port.currentUrl()).search).toBe("Agile");
  sync.destroy();
});
