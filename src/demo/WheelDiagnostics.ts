import type MapView from "@arcgis/core/views/MapView.js";

interface WheelRecord {
  id: number; tMs: number; dtMs: number | null;
  deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean; trusted: boolean;
  sdkDeltaY?: number; decision?: string; zoomBefore?: number; targetZoom?: number;
}

/** Explicit, bounded local capture; never records URLs, credentials or source data. */
export class WheelDiagnostics {
  private enabled = false;
  private label = "";
  private started = 0;
  private previous?: number;
  private records: WheelRecord[] = [];
  private ids = new WeakMap<WheelEvent, WheelRecord>();
  private frames: { tMs: number; zoom: number }[] = [];
  private stops: { tMs: number; reason: string }[] = [];
  private settings: unknown;
  private truncated = false;
  private container?: HTMLElement;

  constructor(private view: MapView) {}

  start(label: string, settings: unknown): void {
    this.detach();
    this.label = String(label).slice(0, 60); this.started = performance.now(); this.previous = undefined;
    this.records = []; this.frames = []; this.stops = []; this.ids = new WeakMap(); this.truncated = false;
    this.settings = structuredClone(settings); this.enabled = true;
    this.container = this.view.container ?? undefined;
    this.container?.addEventListener("wheel", this.onNative, { capture: true, passive: true });
    console.info(`[wheel] Captura «${this.label}» iniciada. Usa un solo dispositivo y termina con stopDiagnostics().`);
  }

  private onNative = (event: WheelEvent): void => { this.record(event); };
  private record(event: WheelEvent): WheelRecord | undefined {
    if (!this.enabled) return;
    const existing = this.ids.get(event);
    if (existing) return existing;
    if (this.records.length >= 1500) { this.truncated = true; return; }
    const now = performance.now();
    const record: WheelRecord = {
      id: this.records.length + 1, tMs: this.round(now - this.started), dtMs: this.previous === undefined ? null : this.round(now - this.previous),
      deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode, ctrlKey: event.ctrlKey, trusted: event.isTrusted,
    };
    this.previous = now; this.records.push(record); this.ids.set(event, record); return record;
  }

  decision(event: WheelEvent, sdkDeltaY: number, decision: string, targetZoom?: number): void {
    const record = this.record(event);
    if (record) Object.assign(record, { sdkDeltaY, decision, zoomBefore: this.view.zoom, targetZoom });
  }
  frame(zoom: number): void {
    if (!this.enabled) return;
    if (this.frames.length < 600) this.frames.push({ tMs: this.round(performance.now() - this.started), zoom });
    else this.truncated = true;
  }
  stopAnimation(reason: string): void {
    if (this.enabled && this.stops.length < 200) this.stops.push({ tMs: this.round(performance.now() - this.started), reason });
  }

  stop(): object {
    this.detach();
    const decisions: Record<string, number> = {};
    for (const record of this.records) decisions[record.decision ?? "not-received-by-sdk-handler"] = (decisions[record.decision ?? "not-received-by-sdk-handler"] ?? 0) + 1;
    const report = {
      label: this.label, durationMs: this.round(performance.now() - this.started),
      browser: navigator.userAgent, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      settings: this.settings, summary: { inputEvents: this.records.length, animatedFrames: this.frames.length, decisions },
      truncated: this.truncated, events: this.records.map(r => ({ ...r })), frames: [...this.frames], stops: [...this.stops],
    };
    console.info("[wheel] Resumen", report.summary);
    console.table(report.events.slice(0, 60), ["id", "dtMs", "deltaY", "deltaMode", "sdkDeltaY", "decision", "zoomBefore", "targetZoom"]);
    return report;
  }
  destroy(): void { this.detach(); }
  private detach(): void {
    this.enabled = false;
    this.container?.removeEventListener("wheel", this.onNative, true); this.container = undefined;
  }
  private round(value: number): number { return Math.round(value * 100) / 100; }
}
