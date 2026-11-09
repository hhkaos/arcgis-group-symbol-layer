/** DOM WheelEvent delta: positive moves away from the map. */
export function wheelPixels(delta: number, mode: number, pageHeight: number): number {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
  return Number.isFinite(pixels) ? Math.max(-240, Math.min(240, pixels)) : 0;
}
export function coarseWheel(delta: number, mode: number): boolean {
  // Mouse drivers can produce fractional values, including ~4 px per slow notch.
  return mode !== 0 || Math.abs(delta) >= 40 || Math.abs(delta) >= 4 && !Number.isInteger(delta);
}
export class WheelInputClassifier {
  private kind?: "mouse" | "trackpad";
  private previous = -Infinity;
  classify(deltaX: number, deltaY: number, mode: number, time: number): "mouse" | "trackpad" {
    if (!deltaX && !deltaY) return this.kind ?? "trackpad";
    if (time - this.previous > 250 || time < this.previous) this.kind = undefined;
    this.previous = time;
    if (mode !== 0) this.kind = "mouse";
    else if (deltaX !== 0) this.kind = "trackpad";
    else this.kind ??= coarseWheel(deltaY, mode) ? "mouse" : "trackpad";
    return this.kind;
  }
  reset(): void { this.kind = undefined; this.previous = -Infinity; }
}
export function anchoredCenter(center: { x: number; y: number }, anchor: { x: number; y: number }, ratio: number): { x: number; y: number } {
  return { x: anchor.x + (center.x - anchor.x) * ratio, y: anchor.y + (center.y - anchor.y) * ratio };
}
