import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { groupCommunities } from "./data";
import type { CommunityCollection } from "./data";
import { inBoundary } from "./presentation";
import type { BoundaryCollection } from "./presentation";
const data: CommunityCollection = JSON.parse(readFileSync("public/data/communities.geojson", "utf8"));

it("preserves source identities through both territorial grouping levels without duplication", () => {
  const before = JSON.stringify(data);
  const ids = data.features.filter(f => f.geometry && f.properties.displayOnMap).map(f => f.properties.sourceId).sort();
  for (const level of ["region", "locality"] as const) {
    const groups = groupCommunities(data, level, true);
    const actual = groups.flatMap(g => g.items.map(i => i.sourceId!)).sort();
    expect(actual).toEqual(ids);
    expect(new Set(actual).size).toBe(actual.length);
  }
  expect(JSON.stringify(data)).toBe(before);
  expect(data.features.filter(f => !f.geometry)).toHaveLength(112);
  expect(groupCommunities(data, "locality", true)).toHaveLength(88);
  expect(data.features.find(f => f.properties.municipalityCode)?.properties.localityId).toMatch(/^municipality:/);
});

it("places every computed administrative anchor inside its own polygon", () => {
  for (const filename of ["territories.geojson", "municipalities.geojson"]) {
    const boundaries: BoundaryCollection = JSON.parse(readFileSync(`public/data/${filename}`, "utf8"));
    for (const f of boundaries.features) expect(inBoundary(f.properties.anchorX, f.properties.anchorY, f.geometry), f.properties.name).toBe(true);
  }
});
