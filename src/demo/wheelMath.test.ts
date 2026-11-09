import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { anchoredCenter, coarseWheel, WheelInputClassifier, wheelPixels } from "./wheelMath";

it("normalizes wheel units, keeps direction, and caps unusually large input", () => {
  expect(wheelPixels(3, 1, 800)).toBe(48);
  expect(wheelPixels(-3, 1, 800)).toBe(-48);
  expect(wheelPixels(1, 2, 800)).toBe(240);
  expect(wheelPixels(-100, 0, 800)).toBe(-100);
  expect(wheelPixels(NaN, 0, 800)).toBe(0);
});
it("leaves fine pixel input native while identifying typical coarse wheel input", () => {
  expect(coarseWheel(2.5, 0)).toBe(false);
  expect(coarseWheel(12, 0)).toBe(false);
  expect(coarseWheel(100, 0)).toBe(true);
  expect(coarseWheel(3, 1)).toBe(true);
  expect(coarseWheel(4.000244140625, 0)).toBe(true);
  expect(coarseWheel(-471.4776611328125, 0)).toBe(true);
});
it("keeps a trackpad gesture native when it accelerates to large integer deltas", () => {
  const classifier = new WheelInputClassifier();
  expect(classifier.classify(0, -1, 0, 0)).toBe("trackpad");
  expect(classifier.classify(0, -133, 0, 17)).toBe("trackpad");
  expect(classifier.classify(0, 4.000244140625, 0, 400)).toBe("mouse");
});
it.each(["mouse", "trackpad"])("replays the reported %s trace without switching between native and smooth handling", device => {
  // Only timing/delta tuples are retained; no browser metadata or other capture content.
  const traces = JSON.parse(readFileSync("src/demo/fixtures/wheel-input.json", "utf8")) as Record<string, number[][]>;
  const classifier = new WheelInputClassifier();
  let time = 0;
  const kinds = traces[device].map(([dt, dx, dy, mode]) => {
    time += dt;
    return classifier.classify(dx, dy, mode, time);
  });
  expect(kinds).toHaveLength(device === "mouse" ? 23 : 225);
  expect(new Set(kinds)).toEqual(new Set([device]));
});
it("keeps the geographic anchor at the same screen point through fractional zoom and rotation", () => {
  const anchor = { x: 135, y: 145 };
  const angle = 0.7;
  const screen = (center: { x: number; y: number }, resolution: number) => {
    const x = (anchor.x - center.x) / resolution, y = (anchor.y - center.y) / resolution;
    return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) };
  };
  let center = { x: 100, y: 200 }, resolution = 2;
  const before = screen(center, resolution);
  for (let i = 0; i < 10; i++) {
    const ratio = 2 ** -0.1;
    center = anchoredCenter(center, anchor, ratio); resolution *= ratio;
    expect(screen(center, resolution).x).toBeCloseTo(before.x, 9);
    expect(screen(center, resolution).y).toBeCloseTo(before.y, 9);
  }
});
