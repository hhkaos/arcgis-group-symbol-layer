import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { appearance, prepareGroups } from "../layer/model";
import { groupCommunities } from "./data";
import type { CommunityCollection } from "./data";
import { adaptivePresentation, fittingBoundary, inBoundary } from "./presentation";
import type { BoundaryCollection } from "./presentation";
import { resolveDemoOptions } from "./config";

it("shows Pamplona, Zaragoza and Burgos logos in free space without requiring municipal containment", () => {
  const read = (file: string) => JSON.parse(readFileSync(`public/data/${file}`, "utf8"));
  const data: CommunityCollection = read("communities.geojson");
  const regions: BoundaryCollection = read("territories.geojson"), localities: BoundaryCollection = read("municipalities.geojson");
  const groups = groupCommunities(data, "locality", true).map(group => {
    const boundary = fittingBoundary(group, regions, localities, "group");
    return boundary ? { ...group, anchor: { x: boundary.properties.anchorX, y: boundary.properties.anchorY, wkid: 4326 as const } } : group;
  });
  const active = new Set(data.features.filter(f => f.properties.status === "active").map(f => f.properties.sourceId));
  const filter = (item: { sourceId?: string }) => active.has(item.sourceId!);
  const settings = appearance({ detailZoom: 9, imageSize: 32, dotSize: 8, gap: 3, maxColumns: 12 });
  // Web Mercator at zoom 8, desktop-sized viewport centered on northern Spain.
  const scale = 256 * 2 ** 8;
  const world = (lon: number, lat: number) => ({ x: (lon + 180) / 360 * scale, y: (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 * scale });
  const center = world(-2.2, 42.25);
  const policy = resolveDemoOptions().presentation.territoryConstraint;
  const adapted = adaptivePresentation(groups, 8, settings, filter, group => {
    const p = world(group.anchor.x, group.anchor.y);
    return { x: p.x - center.x + 512, y: p.y - center.y + 325 };
  }, (group, x, y) => {
    const boundary = fittingBoundary(group, regions, localities, policy);
    const lon = (x - 512 + center.x) / scale * 360 - 180;
    const lat = Math.atan(Math.exp(Math.PI * (1 - 2 * (y - 325 + center.y) / scale))) * 360 / Math.PI - 90;
    return !!boundary && inBoundary(lon, lat, boundary.geometry);
  });
  for (const [label, count] of [["Pamplona/Iruña", 1], ["Zaragoza", 6], ["Burgos", 1]] as const) {
    const group = adapted.find(g => g.label === label)!;
    expect(group, label).toMatchObject({ variant: "images", presentation: "items" });
    expect(prepareGroups([group], 8, settings, filter)[0].counts.displayed, label).toBe(count);
  }
});
