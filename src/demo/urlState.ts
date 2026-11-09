import type { Language } from "./i18n";

export interface SharedView {
  longitude: number; latitude: number; scale: number; rotation: number;
  width: number; height: number;
}
export interface SharedState {
  language: Language;
  search: string; category: string; status: "active" | "inactive" | "unknown" | "";
  region: string; province: string; group: string; visibleOnly: boolean;
  dataset: "communities" | "reference" | "stress";
  grouping: "auto" | "region" | "locality";
  level: "region" | "locality";
  variant: "mixed" | "images" | "dots";
  view?: SharedView;
}
const keys = ["lang", "q", "type", "status", "region", "province", "group", "visible", "dataset", "grouping", "level", "variant", "view"];
function choice<T extends string>(value: string | null, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? value as T : fallback;
}
export function readSharedState(url: URL, fallbackLanguage: Language = "en"): SharedState {
  const p = url.searchParams;
  const token = (key: string) => (p.get(key) ?? "").slice(0, 256);
  const result: SharedState = {
    language: choice(p.get("lang"), ["en", "es"], fallbackLanguage),
    search: (p.get("q") ?? "").slice(0, 500), category: token("type"),
    status: p.get("status") === "all" ? "" : choice(p.get("status"), ["active", "inactive", "unknown"], "active"),
    region: token("region"), province: token("province"), group: token("group"), visibleOnly: p.get("visible") !== "0",
    dataset: choice(p.get("dataset"), ["communities", "reference", "stress"], "communities"),
    grouping: choice(p.get("grouping"), ["auto", "region", "locality"], "auto"),
    level: choice(p.get("level"), ["region", "locality"], "region"),
    variant: choice(p.get("variant"), ["mixed", "images", "dots"], "mixed"),
  };
  const raw = p.get("view")?.split(",");
  if (raw?.length === 6 && raw.every(s => s.trim() !== "")) {
    const [longitude, latitude, scale, rotation, width, height] = raw.map(Number);
    if ([longitude, latitude, scale, rotation, width, height].every(Number.isFinite)
      && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 85.05112878
      && scale > 0 && scale <= 1e10 && width >= 1 && width <= 20000 && height >= 1 && height <= 20000) {
      result.view = { longitude, latitude, scale, rotation: (rotation % 360 + 360) % 360, width, height };
    }
  }
  return result;
}
export function sharedStateUrl(base: URL, state: SharedState): URL {
  const url = new URL(base); const p = url.searchParams;
  for (const key of keys) p.delete(key);
  p.set("lang", state.language);
  if (state.search) p.set("q", state.search);
  if (state.category) p.set("type", state.category);
  p.set("status", state.status || "all");
  if (state.region) p.set("region", state.region);
  if (state.province && state.region) p.set("province", state.province);
  if (state.group) p.set("group", state.group);
  if (!state.visibleOnly) p.set("visible", "0");
  if (state.dataset !== "communities") p.set("dataset", state.dataset);
  if (state.grouping !== "auto") p.set("grouping", state.grouping);
  if (state.grouping === "auto" && state.level === "locality") p.set("level", state.level);
  if (state.variant !== "mixed") p.set("variant", state.variant);
  if (state.view) {
    const v = state.view;
    p.set("view", [v.longitude.toFixed(8), v.latitude.toFixed(8), v.scale.toFixed(4), v.rotation.toFixed(4), Math.round(v.width), Math.round(v.height)].join(","));
  }
  return url;
}
/** Keep the previous screen footprint visible at the same rotation on a different viewport. */
export function restoredScale(view: SharedView, width: number, height: number): number {
  return view.scale * Math.max(view.width / Math.max(1, width), view.height / Math.max(1, height));
}

export interface HistoryPort {
  currentUrl(): URL;
  write(url: URL, replace: boolean): void;
  listen(callback: () => void): () => void;
}
function browserPort(): HistoryPort {
  return {
    currentUrl: () => new URL(location.href),
    write: (url, replace) => {
      const state = { ...history.state, communityMap: true };
      if (replace) history.replaceState(state, "", url); else history.pushState(state, "", url);
    },
    listen: callback => { window.addEventListener("popstate", callback); return () => window.removeEventListener("popstate", callback); },
  };
}
/** One checkpoint per settled interaction; restoration never pushes another entry. */
export class UrlHistory {
  private timer?: ReturnType<typeof setTimeout>;
  private epoch = 0;
  private restoring = false;
  private disposed = false;
  private editing = false;
  private editHasEntry = false;
  private finishAfterWrite = false;
  private stopListening: () => void;
  constructor(private capture: () => SharedState, private apply: (state: SharedState) => Promise<void>, private canWrite: () => boolean, private port: HistoryPort = browserPort()) {
    this.stopListening = port.listen(() => { void this.pop().catch(error => console.error("Unable to restore map URL", error)); });
    this.write(true);
  }
  schedule(): void {
    if (this.disposed || this.restoring) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 450);
  }
  flush(): void {
    clearTimeout(this.timer);
    if (this.disposed || this.restoring) return;
    if (!this.canWrite()) { this.schedule(); return; }
    const changed = this.write(this.editing && this.editHasEntry);
    if (changed && this.editing) this.editHasEntry = true;
    if (this.finishAfterWrite) this.resetEdit();
  }
  /** Keep a whole focused search edit in one history entry, even with long pauses. */
  updateSearch(): void {
    const firstChange = !this.editing;
    if (firstChange) { this.editing = true; this.editHasEntry = false; }
    this.finishAfterWrite = false;
    if (firstChange) this.flush(); else this.schedule();
  }
  finishSearch(): void {
    if (!this.editing) return;
    this.finishAfterWrite = true; this.flush();
  }
  private resetEdit(): void { this.editing = false; this.editHasEntry = false; this.finishAfterWrite = false; }
  private write(replace: boolean): boolean {
    const current = this.port.currentUrl(), next = sharedStateUrl(current, this.capture());
    if (next.href !== current.href) {
      // Sidebar/window resizing updates the current checkpoint, not the Back stack.
      const previousView = current.searchParams.get("view")?.split(",");
      const nextView = next.searchParams.get("view")?.split(",");
      const resized = new URL(current);
      if (nextView) resized.searchParams.set("view", nextView.join(","));
      const resizeOnly = previousView?.length === 6 && nextView?.length === 6
        && previousView.slice(0, 4).join(",") === nextView.slice(0, 4).join(",") && resized.href === next.href;
      this.port.write(next, replace || resizeOnly); return true;
    }
    return false;
  }
  private async pop(): Promise<void> {
    const epoch = ++this.epoch;
    clearTimeout(this.timer); this.restoring = true; this.resetEdit();
    let restored = false;
    try { await this.apply(readSharedState(this.port.currentUrl(), this.capture().language)); restored = true; }
    finally {
      if (epoch === this.epoch && !this.disposed) { this.restoring = false; if (restored) this.write(true); }
    }
  }
  destroy(): void { this.disposed = true; ++this.epoch; clearTimeout(this.timer); this.stopListening(); }
}
