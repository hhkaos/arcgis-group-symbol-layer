import type { GroupItem, SymbolGroup } from "../layer/model";
import { t } from "./i18n";

export interface CommunityProperties {
  id: number;
  sourceId: string;
  name: string;
  location: string;
  communityType: string;
  status: string;
  tags: string[];
  langs: string[];
  shortDescription?: string;
  topics?: string;
  imageUrl?: string;
  communityUrl?: string;
  regionId?: string;
  regionName?: string;
  localityId?: string;
  localityName?: string;
  municipalityCode?: string;
  provinceId?: string;
  provinceName?: string;
  displayOnMap: boolean;
}
export interface CommunityFeature {
  type: "Feature";
  id: number;
  geometry: { type: "Point"; coordinates: [number, number] } | null;
  properties: CommunityProperties;
}
export interface CommunityCollection { type: "FeatureCollection"; features: CommunityFeature[] }
export type Grouping = "region" | "locality";

export function groupCommunities(data: CommunityCollection, level: Grouping, images: boolean): SymbolGroup[] {
  const buckets = new Map<string, CommunityFeature[]>();
  for (const feature of data.features) {
    if (!feature.geometry || !feature.properties.displayOnMap) continue;
    const p = feature.properties;
    // Unassigned coordinates still appear in their own group at either level.
    const id = level === "region" ? p.regionId ?? p.localityId! : p.localityId!;
    const rows = buckets.get(id) ?? [];
    rows.push(feature); buckets.set(id, rows);
  }
  return [...buckets].map(([id, rows]) => {
    const locations = new Map<string, { count: number; row: CommunityFeature }>();
    for (const row of rows) {
      const key = row.properties.localityId!;
      const place = locations.get(key) ?? { count: 0, row };
      place.count++; locations.set(key, place);
    }
    // Representative regional anchor: locality with most supplied communities.
    const anchor = [...locations.values()].sort((a, b) => b.count - a.count)[0].row.geometry!.coordinates;
    const names = new Map<string, number>();
    for (const row of rows) names.set(row.properties.location, (names.get(row.properties.location) ?? 0) + 1);
    const localityName = [...names].sort((a, b) => b[1] - a[1])[0][0];
    return {
      id: `${level}:${id}`, label: level === "region" && rows[0].properties.regionName ? rows[0].properties.regionName : rows[0].properties.localityName ?? localityName,
      territoryId: rows[0].properties.regionId ?? `unassigned:${id}`,
      anchor: { x: anchor[0], y: anchor[1], wkid: 4326 },
      variant: images ? "images" : "dots",
      items: rows.map(row => communityItem(row.properties)),
    };
  });
}

export function communityItem(p: CommunityProperties): GroupItem {
  return { id: p.sourceId, sourceId: p.sourceId, label: p.name, category: p.communityType || "unknown", image: p.imageUrl, imageFit: "contain", url: p.communityUrl, description: [p.location, p.shortDescription || p.topics, ...p.tags].filter(Boolean).join(" · ") };
}

export function resolveLevel(mode: "auto" | Grouping, zoom: number, previous: Grouping = "region"): Grouping {
  if (mode !== "auto") return mode;
  // Hysteresis avoids regrouping repeatedly near the threshold during pinch zoom.
  return previous === "region" ? zoom >= 7.2 ? "locality" : "region" : zoom <= 6.8 ? "region" : "locality";
}

const asset = (name: string) => `${import.meta.env.BASE_URL}images/${name}.svg`;
export function referenceGroups(): SymbolGroup[] {
  const sizes = [0, 1, 3, 6, 7, 24, 7, 7];
  return sizes.map((size, index) => ({
    id: `reference:${index}`, label: index >= 6 ? t("Overlap {count}", { count: index - 5 }) : t("{count} items", { count: size }),
    territoryId: `reference:${index % 2}`,
    anchor: { x: index >= 6 ? -1 : -8 + (index % 3) * 4, y: index >= 6 ? 36 : 43 - Math.floor(index / 3) * 4, wkid: 4326 },
    variant: index === 2 || index === 5 ? "dots" : "images",
    items: Array.from({ length: size }, (_, i) => ({
      id: `item:${i}`, sourceId: `reference:${index}:${i}`,
      label: t(index === 5 ? "Person {count}" : "Community {count}", { count: i + 1 }),
      category: i === 2 ? "unknown" : ["tech-meetup", "hacklab", "conference"][i % 3],
      image: i === 4 ? undefined : i === 3 ? asset("missing") : asset(i % 3 === 0 ? "wide" : i % 3 === 1 ? "tall" : "portrait"),
      imageFit: i % 3 === 2 ? "cover" : "contain",
      description: t("Fictional local example. Tests identity, ordering, categories, images, and accessibility."),
    })),
  }));
}

export function stressGroups(): SymbolGroup[] {
  const sizes = [0, 1, 3, 6, 7, 24];
  return Array.from({ length: 470 }, (_, index) => {
    const count = index < 6 ? sizes[index] : index < 320 ? 3 : 2;
    return {
      id: `stress:${index}`, label: t("Test group {count}", { count: index + 1 }), territoryId: `stress:${index % 19}`,
      anchor: { x: -8.8 + ((index * 37) % 131) / 10, y: 36.1 + ((index * 23) % 76) / 10, wkid: 4326 },
      variant: index % 2 === 0 ? "dots" : "images",
      items: Array.from({ length: count }, (_, i) => ({ id: `item:${i}`, label: t("Item {count}", { count: `${index + 1}.${i + 1}` }), category: i % 2 ? "hacklab" : "tech-meetup", image: asset(i % 2 ? "tall" : "wide"), imageFit: "contain" })),
    };
  });
}
