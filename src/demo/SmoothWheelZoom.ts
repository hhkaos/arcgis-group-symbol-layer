import Point from "@arcgis/core/geometry/Point.js";
import Viewpoint from "@arcgis/core/Viewpoint.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type { DemoOptions } from "./config";
import { anchoredCenter, WheelInputClassifier, wheelPixels } from "./wheelMath";
import { WheelDiagnostics } from "./WheelDiagnostics";

/** Optional application navigation; no private SDK navigation APIs. */
export class SmoothWheelZoom {
  private frame = 0;
  private target?: number;
  private anchor?: Point;
  private startZoom = 0;
  private startTime = 0;
  private disposed = false;
  private handles: { remove(): void }[];
  private motion = matchMedia("(prefers-reduced-motion: reduce)");
  private diagnostics: WheelDiagnostics;
  private classifier = new WheelInputClassifier();
  readonly stats = { handledEvents: 0, nativeEvents: 0, frames: 0, lastDelta: 0 };

  constructor(private view: MapView, private options: DemoOptions["navigation"], private activity: (active: boolean) => void) {
    this.diagnostics = new WheelDiagnostics(view);
    this.handles = [view.on("mouse-wheel", event => {
      const native = event.native;
      const kind = this.classifier.classify(native.deltaX, native.deltaY, native.deltaMode, native.timeStamp);
      const nativeTrackpad = this.options.inputMode === "trackpad" || this.options.inputMode === "auto" && this.options.preserveTrackpad && kind === "trackpad";
      const nativeReason = !this.options.smoothWheelZoom ? "native-disabled" : this.motion.matches ? "native-reduced-motion" : native.ctrlKey ? "native-ctrl-key" : nativeTrackpad ? "native-trackpad" : undefined;
      if (nativeReason) {
        this.diagnostics.decision(native, event.deltaY, nativeReason);
        this.stats.nativeEvents++; this.cancel(nativeReason); return;
      }
      const delta = wheelPixels(native.deltaY, native.deltaMode, view.height);
      if (!delta || !view.ready) { this.diagnostics.decision(native, event.deltaY, !delta ? "ignored-zero-delta" : "ignored-view-not-ready"); return; }
      const anchor = view.toMap({ x: event.x, y: event.y });
      if (!anchor) { this.diagnostics.decision(native, event.deltaY, "ignored-no-anchor"); return; }
      event.stopPropagation(); native.preventDefault();
      view.animation?.stop();
      const min = view.constraints.effectiveMinZoom, max = view.constraints.effectiveMaxZoom;
      this.target = Math.max(min, Math.min(max, (this.target ?? view.zoom) - delta * this.options.sensitivity));
      this.diagnostics.decision(native, event.deltaY, "smooth", this.target);
      this.anchor = anchor; this.startZoom = view.zoom; this.startTime = performance.now();
      this.stats.handledEvents++; this.stats.lastDelta = delta;
      if (!this.frame) { this.activity(true); this.frame = requestAnimationFrame(this.tick); }
    }), view.on("pointer-down", () => this.cancel("pointer-down")), view.on("key-down", () => this.cancel("key-down")), view.on("resize", () => this.cancel("resize"))];
    this.motion.addEventListener("change", this.onMotionChange);
  }

  get active(): boolean { return this.frame !== 0; }
  startDiagnostics(label = "wheel"): void { this.diagnostics.start(label, this.options); }
  stopDiagnostics(): object { return this.diagnostics.stop(); }
  configure(options: DemoOptions["navigation"]): void { this.cancel("configuration-changed"); this.classifier.reset(); this.options = { ...options }; }
  cancel = (reason = "external-navigation"): void => {
    const active = !!this.frame;
    if (active) this.diagnostics.stopAnimation(reason);
    cancelAnimationFrame(this.frame); this.frame = 0; this.target = undefined; this.anchor = undefined;
    if (active && !this.disposed && !this.view.destroyed) this.activity(false);
  };
  private onMotionChange = (): void => { this.cancel("motion-preference-changed"); };
  destroy(): void { this.disposed = true; this.cancel("destroyed"); this.diagnostics.destroy(); this.handles.forEach(h => h.remove()); this.motion.removeEventListener("change", this.onMotionChange); }

  private tick = (now: number): void => {
    const reason = this.target === undefined || !this.anchor ? "no-target" : this.view.destroyed ? "view-destroyed" : this.view.interacting ? "view-interacting" : this.view.animation ? "other-animation" : undefined;
    if (reason) { this.cancel(reason); return; }
    const progress = Math.max(0, Math.min(1, (now - this.startTime) / this.options.durationMs));
    const zoom = this.startZoom + (this.target! - this.startZoom) * (1 - (1 - progress) ** 3);
    const ratio = 2 ** (this.view.zoom - zoom);
    const center = anchoredCenter(this.view.center, this.anchor!, ratio);
    this.view.viewpoint = new Viewpoint({
      targetGeometry: new Point({ ...center, spatialReference: this.view.spatialReference }),
      scale: this.view.scale * ratio, rotation: this.view.rotation,
    });
    this.stats.frames++;
    this.diagnostics.frame(this.view.zoom);
    if (progress < 1) this.frame = requestAnimationFrame(this.tick);
    else this.cancel("completed");
  };
}
