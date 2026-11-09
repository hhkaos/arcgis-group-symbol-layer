import "./style.css";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-compass";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-input";
import "@esri/calcite-components/components/calcite-select";
import "@esri/calcite-components/components/calcite-option";
import "@esri/calcite-components/components/calcite-switch";
import "@esri/calcite-components/components/calcite-slider";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-flow";
import "@esri/calcite-components/components/calcite-flow-item";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-action";
import "@esri/calcite-components/components/calcite-chip";
import "@esri/calcite-components/components/calcite-tooltip";
import ArcGISMap from "@arcgis/core/Map.js";
import Basemap from "@arcgis/core/Basemap.js";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer.js";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol.js";
import TileInfo from "@arcgis/core/layers/support/TileInfo.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import Extent from "@arcgis/core/geometry/Extent.js";
import Point from "@arcgis/core/geometry/Point.js";
import * as webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils.js";
import MapViewConstraints from "@arcgis/core/views/2d/MapViewConstraints.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import { isAbortError } from "@arcgis/core/core/promiseUtils.js";
import * as intl from "@arcgis/core/intl.js";
import esriConfig from "@arcgis/core/config.js";
import { GroupSymbolLayer } from "./layer/GroupSymbolLayer";
import { safeUrl } from "./layer/model";
import type { Activation, GroupItem, ItemFilter, PreparedGroup, SymbolGroup } from "./layer/model";
import { communityItem, groupCommunities, referenceGroups, resolveLevel, stressGroups } from "./demo/data";
import type { CommunityCollection, Grouping } from "./demo/data";
import { adaptivePresentation, fittingBoundary, inBoundary } from "./demo/presentation";
import type { BoundaryCollection } from "./demo/presentation";
import initialOptions from "../demo.config";
import { resolveDemoOptions } from "./demo/config";
import type { BoundaryMode, BoundaryClickAction, DemoOptionsInput } from "./demo/config";
import { SmoothWheelZoom } from "./demo/SmoothWheelZoom";
import { ResultList } from "./demo/ResultList";
import { language, localize, setLanguage, t } from "./demo/i18n";
import { openDirectory, setupInterface, showDetails } from "./demo/interface";
import { readSharedState, restoredScale, UrlHistory } from "./demo/urlState";
import type { SharedState } from "./demo/urlState";

const initialSharedState = readSharedState(new URL(location.href), language());
setLanguage(initialSharedState.language);
let options = resolveDemoOptions(initialOptions);
let urlHistory: UrlHistory | undefined;
let navigationEpoch = 0;
let filterNavigation = false;
let restoreEpoch = 0;
let wheelNavigation: SmoothWheelZoom | undefined;
let directoryOptionsChanged: (() => void) | undefined;
let presentationOptionsChanged: (() => void) | undefined;

intl.setLocale(language());
localize();
document.title = t("SPAIN’S TECH COMMUNITY ECOSYSTEM");
const apiKey = import.meta.env.VITE_ARCGIS_API_KEY?.trim();
if (apiKey) esriConfig.apiKey = apiKey;
const mapElement = document.querySelector("arcgis-map")!;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const select = (id: string) => $<HTMLCalciteSelectElement>(id);
const resultList = new ResultList($("results"));

const base = import.meta.env.BASE_URL;
const colors: Record<string, string> = { "tech-meetup": "#167c72", conference: "#d69a36", hacklab: "#6d70b6", "collaborative-group": "#3c83ad", "umbrella-org": "#bc6b6b" };
const categoryNames: Record<string, string> = { "tech-meetup": "Meetup", conference: "Conference", hacklab: "Hacklab", "collaborative-group": "Collaborative group", "umbrella-org": "Organization", "meta-community": "Community network", "mutual-aid": "Mutual aid", unknown: "Uncategorized" };
const categoryLabel = (category: string) => t(categoryNames[category] ?? category);
const layer = new GroupSymbolLayer({ title: "Tech communities", appearance: { colors, imageSize: 32, detailZoom: 9 } });
const regionSymbol = new SimpleFillSymbol({ color: [247, 247, 240, 0.2], outline: { color: [83, 114, 100, 0.9], width: 1.2 } });
const territories = new GeoJSONLayer({
  url: `${base}data/territories.geojson`, title: "Autonomous communities", objectIdField: "objectid", outFields: ["*"],
  popupEnabled: false, visible: options.boundaries.mode !== "none",
  renderer: { type: "simple", symbol: regionSymbol },
  labelingInfo: [{ labelExpressionInfo: { expression: "$feature.name" }, minScale: 12000000, symbol: { type: "text", color: "#526c5e", haloColor: "#ffffff", haloSize: 1.5, font: { size: 9, family: "Arial" } } }],
});
const adminBase = "https://services1.arcgis.com/nCKYwcSONQTkPA4K/arcgis/rest/services/";
const provinces = new FeatureLayer({ url: `${adminBase}Prov/FeatureServer/0`, title: "Provinces", visible: false, popupEnabled: false, outFields: ["NAMEUNIT", "NATCODE", "CODNUT2"], renderer: { type: "simple", symbol: { type: "simple-fill", color: [255,255,255,0], outline: { color: "#81907e", width: 0.9, style: "dash" } } }, labelingInfo: [{ labelExpressionInfo: { expression: "$feature.NAMEUNIT" }, symbol: { type: "text", color: "#526c5e", haloColor: "#fff", haloSize: 1.5, font: { size: 9 } } }] });
const municipalities = new FeatureLayer({ url: `${adminBase}muni/FeatureServer/0`, title: "Municipalities", visible: false, minScale: 2000000, popupEnabled: false, outFields: ["NAMEUNIT", "NATCODE", "CODNUT2", "codine"], renderer: { type: "simple", symbol: { type: "simple-fill", color: [255,255,255,0], outline: { color: "#83998b", width: 0.65 } } }, labelingInfo: [{ minScale: 350000, labelExpressionInfo: { expression: "$feature.NAMEUNIT" }, symbol: { type: "text", color: "#3b5b4b", haloColor: "#fff", haloSize: 1.5, font: { size: 9 } } }] });
function updateBoundaries(): void {
  const mode = options.boundaries.mode;
  const names = options.boundaries.labels;
  territories.labelsVisible = names; provinces.labelsVisible = names; municipalities.labelsVisible = names;
  territories.visible = mode !== "none";
  provinces.visible = mode === "provinces" || mode === "auto" && mapElement.zoom >= 6.5 && mapElement.zoom < 8.5;
  municipalities.visible = mode === "municipalities" || mode === "auto" && mapElement.zoom >= 8.5;
  $("boundary-hint").textContent = t(mode === "none" ? "Boundaries are hidden; territorial grouping is still available." : municipalities.visible && mapElement.scale > municipalities.minScale ? "Zoom in to inspect municipal boundaries." : options.boundaries.clickAction === "none" ? "Boundary clicks have no action." : "Click a boundary to inspect its territory.");
}
function applyReferenceVisibility(): void {
  mapElement.map?.basemap?.referenceLayers.forEach(reference => { reference.visible = options.basemap.referenceLayersVisible; });
}
function configureDemo(input: DemoOptionsInput): void {
  const previousScope = options.directory.mapExtentOnly;
  const previousPresentation = JSON.stringify(options.presentation);
  const previousNavigation = JSON.stringify(options.navigation);
  options = resolveDemoOptions(input, options);
  select("boundaries").value = options.boundaries.mode;
  select("boundary-click").value = options.boundaries.clickAction;
  $<HTMLCalciteSwitchElement>("boundary-names").checked = options.boundaries.labels;
  $<HTMLCalciteSwitchElement>("smooth-wheel").checked = options.navigation.smoothWheelZoom;
  select("wheel-input").value = options.navigation.inputMode;
  $<HTMLCalciteSwitchElement>("visible-results").checked = options.directory.mapExtentOnly;
  if (previousNavigation !== JSON.stringify(options.navigation)) wheelNavigation?.configure(options.navigation);
  updateBoundaries(); applyReferenceVisibility();
  if (previousScope !== options.directory.mapExtentOnly) directoryOptionsChanged?.();
  if (previousPresentation !== JSON.stringify(options.presentation)) presentationOptionsChanged?.();
  urlHistory?.flush();
}
let lastHighlighted: string | undefined;
reactiveUtils.watch(() => layer.revision, () => {
  const id = layer.selectedTerritory;
  if (id === lastHighlighted) return;
  lastHighlighted = id;
  territories.renderer = new UniqueValueRenderer({ field: "id", defaultSymbol: regionSymbol, uniqueValueInfos: id ? [{ value: id, symbol: new SimpleFillSymbol({ color: [226, 173, 72, 0.16], outline: { color: "#b5751b", width: 2.4 } }) }] : [] });
});
mapElement.spatialReference = SpatialReference.WebMercator;
mapElement.constraints = new MapViewConstraints({ snapToZoom: false, minZoom: 2, maxZoom: 17, lods: TileInfo.create({ spatialReference: SpatialReference.WebMercator }).lods });
mapElement.map = new ArcGISMap({ basemap: apiKey ? new Basemap({ style: { id: "arcgis/light-gray" } }) : new Basemap({ baseLayers: [] }), layers: [municipalities, provinces, territories, layer] });
const referenceHandle = reactiveUtils.watch(() => mapElement.map?.basemap?.referenceLayers.length, () => {
  applyReferenceVisibility();
}, { initial: true });
mapElement.popupDisabled = true;
mapElement.aria = { label: t("Interactive tech community map"), description: t("Use the directory to inspect communities with the keyboard.") };
const notice = $("map-notice");
if (!apiKey) { notice.hidden = false; notice.textContent = t("Configure an API key to load the light gray basemap. Community symbols remain available."); }
configureDemo(options);

let data: CommunityCollection = { type: "FeatureCollection", features: [] };
let regionBoundaries: BoundaryCollection = { features: [] };
let localBoundaries: BoundaryCollection = { features: [] };
let groups: SymbolGroup[] = [];
let dataset = "communities";
let grouping: "auto" | Grouping = "auto";
let level: Grouping = "region";
let focusedGroup = "";
let page = 0;
let attached = true;
let ready = false;
let lastFilter: ItemFilter | undefined;
let previousDetail: boolean | undefined;
let pinnedPlace = "";
let tooltipEpoch = 0;
function closeMapTooltip(): void { tooltipEpoch++; $<HTMLCalciteTooltipElement>("map-tooltip").open = false; }
function showMapTooltip(name: string, x: number, y: number): void {
  const tooltip = $<HTMLCalciteTooltipElement>("map-tooltip");
  $("map-tooltip-anchor").style.transform = `translate(${x}px, ${y}px)`;
  tooltip.textContent = name; tooltip.open = true; void tooltip.reposition();
}
function placeInfo(name: string, pin = false): void {
  if (pin) pinnedPlace = name;
  $("place-info").textContent = name; $("place-info").hidden = !name;
}
const pageSize = 12;
const resultCollator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
const optionsSignatures = new Map<string, string>();
let legendSignature = "";
let mapRefreshTimer: ReturnType<typeof setTimeout> | undefined;
function text(id: string, value: string): void { const node = $(id); if (node.textContent !== value) node.textContent = value; }
function scheduleMapRefresh(): void {
  clearTimeout(mapRefreshTimer);
  mapRefreshTimer = setTimeout(() => {
    if (!ready || !mapElement.stationary || wheelNavigation?.active) return;
    applyAdaptivePresentation(); refreshResults(true);
  }, 160);
}
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
function boundaryFor(group: SymbolGroup): BoundaryCollection["features"][number] | undefined {
  return fittingBoundary(group, regionBoundaries, localBoundaries, "group");
}
function applyAdaptivePresentation(): void {
  if (!ready || dataset !== "communities" || select("variant").value !== "mixed") return;
  const view = mapElement.view;
  const adapted = adaptivePresentation(groups, mapElement.zoom, layer.config, lastFilter,
    group => view.toScreen(new Point({ x: group.anchor.x, y: group.anchor.y, spatialReference: { wkid: group.anchor.wkid } })) ?? undefined,
    (group, x, y) => {
      if (options.presentation.territoryConstraint === "none") return true;
      const boundary = fittingBoundary(group, regionBoundaries, localBoundaries, options.presentation.territoryConstraint);
      if (!boundary) return false;
      const point = view.toMap({ x, y });
      if (!point) return false;
      const geographic = point.spatialReference.isWGS84 ? point : webMercatorUtils.webMercatorToGeographic(point) as Point;
      return inBoundary(geographic.x, geographic.y, boundary.geometry);
    }, options.presentation);
  const changed = adapted.some((g, i) => g.variant !== groups[i].variant || g.presentation !== groups[i].presentation || g.visibleItems !== groups[i].visibleItems);
  groups = adapted;
  if (changed) layer.setData(groups);
}

function option(value: string, label: string): HTMLCalciteOptionElement {
  const el = document.createElement("calcite-option"); el.value = value; el.textContent = label; return el;
}
function setOptions(id: string, values: [string, string][], initial: string): void {
  const signature = JSON.stringify([initial, values]);
  if (optionsSignatures.get(id) === signature) return;
  optionsSignatures.set(id, signature);
  const el = select(id), previous = el.value;
  el.replaceChildren(option("", initial), ...values.map(([value, text]) => option(value, text)));
  el.value = values.some(([v]) => v === previous) ? previous : "";
}
function updateData(preserveDirectory = false): void {
  closeMapTooltip();
  previousDetail = undefined;
  const variant = select("variant").value;
  groups = dataset === "communities" ? groupCommunities(data, level, variant !== "dots") : dataset === "reference" ? referenceGroups() : stressGroups();
  if (dataset === "communities") groups = groups.map(group => {
    const boundary = boundaryFor(group);
    return boundary ? { ...group, anchor: { x: boundary.properties.anchorX, y: boundary.properties.anchorY, wkid: 4326 } } : group;
  });
  if (variant === "images" || variant === "dots") groups = groups.map(g => ({ ...g, variant }));
  layer.configure({ detailZoom: dataset === "communities" ? 9 : 4.5, dotSize: dataset === "communities" ? 8 : 12, gap: dataset === "communities" ? 3 : 5, maxColumns: dataset === "communities" ? 12 : 6, summarizeDots: dataset === "communities", showLabels: false, declutterCounts: dataset === "communities" });
  layer.setData(groups);
  const categories = [...new Set(dataset === "communities" ? data.features.map(f => f.properties.communityType || "unknown") : groups.flatMap(g => g.items.map(i => i.category)))].sort();
  setOptions("category", categories.map(c => [c, categoryLabel(c)]), t("All types"));
  const regionNames = new Map<string, string>();
  for (const feature of data.features) if (feature.properties.regionId) regionNames.set(feature.properties.regionId, feature.properties.regionName!);
  setOptions("territory", dataset === "communities" ? [...regionNames].sort((a, b) => a[1].localeCompare(b[1], "es")) : [...new Set(groups.map(g => g.territoryId!))].map(id => [id, id]), t("All of Spain"));
  updateProvinces();
  if (preserveDirectory) { layer.setFilter(lastFilter); scheduleMapRefresh(); }
  else { focusedGroup = ""; applyFilters(); }
  updateLevelLabel();
}
function updateLevelLabel(): void {
  text("level-label", t(dataset !== "communities" ? dataset === "reference" ? "Reference cases" : "Validation workload" : level === "region" ? "By autonomous community" : "By locality"));
}

function updateProvinces(): void {
  const region = select("territory").value;
  const names = new Map<string, string>();
  if (region && dataset === "communities") for (const f of data.features) {
    const p = f.properties;
    if (p.regionId === region && p.provinceId) names.set(p.provinceId, p.provinceName ?? p.provinceId);
  }
  setOptions("province", [...names].sort((a, b) => a[1].localeCompare(b[1], language())), t("All provinces"));
  $("province-field").hidden = !region || dataset !== "communities";
}
function updateFilterSummary(): void {
  const summary = [select("territory"), select("province"), select("status"), select("category")].filter(el => el.value).map(el => Array.from(el.querySelectorAll("calcite-option")).find(o => o.value === el.value)?.textContent?.trim()).filter(Boolean);
  $<HTMLCalciteBlockElement>("filters").description = summary.join(" · ");
}

function applyFilters(): void {
  clearTimeout(mapRefreshTimer);
  closeMapTooltip();
  const search = normalize($<HTMLCalciteInputElement>("search").value), category = select("category").value, status = select("status").value;
  const propertiesById = new Map(data.features.map(f => [f.properties.sourceId, f.properties]));
  const region = select("territory").value, province = select("province").value;
  lastFilter = item => {
    const p = propertiesById.get(item.sourceId!);
    return (!category || item.category === category) && (!status || dataset !== "communities" || p?.status === status)
      && (dataset !== "communities" || (!region || p?.regionId === region) && (!province || p?.provinceId === province))
      && (!search || normalize(`${item.label} ${item.description ?? ""}`).includes(search));
  };
  updateFilterSummary();
  applyAdaptivePresentation();
  layer.setFilter(lastFilter); page = 0;
  refreshResults(true);
}

interface Result { group?: PreparedGroup; item: GroupItem; unmapped?: boolean }
function resultKey(result: Result): string {
  return dataset === "communities" ? `community:${result.item.sourceId ?? result.item.id}` : `${result.group?.group.id}:${result.item.id}`;
}
function groupInViewport(prepared: PreparedGroup): boolean {
  const anchor = prepared.group.anchor;
  const p = mapElement.view.toScreen(new Point({ x: anchor.x, y: anchor.y, spatialReference: { wkid: anchor.wkid } }));
  if (!p) return false;
  return prepared.cells.some(c => p.x + c.x + c.size / 2 >= 0 && p.y + c.y + c.size / 2 >= 0 && p.x + c.x - c.size / 2 <= mapElement.view.width && p.y + c.y - c.size / 2 <= mapElement.view.height);
}
function results(): { prepared: PreparedGroup[]; items: Result[] } {
  const allPrepared = layer.getResults(mapElement.zoom);
  const prepared = options.directory.mapExtentOnly && ready ? allPrepared.filter(groupInViewport) : allPrepared;
  const selection = select("territory").value;
  const relevant = prepared.filter(g => (!selection || g.group.territoryId === selection) && (!focusedGroup || g.group.id === focusedGroup));
  const items: Result[] = relevant.flatMap(g => g.matching.map(item => ({ group: g, item })));
  if (!options.directory.mapExtentOnly && dataset === "communities" && !selection && (!focusedGroup || focusedGroup === "unmapped")) {
    if (focusedGroup === "unmapped") items.length = 0;
    for (const f of data.features) if ((!f.geometry || !f.properties.displayOnMap) && (!lastFilter || lastFilter(communityItem(f.properties), { id: "unmapped", label: t("Not shown on the map"), items: [], variant: "images", anchor: { x: 0, y: 0, wkid: 4326 } }))) items.push({ item: communityItem(f.properties), unmapped: true });
  }
  items.sort((a, b) => resultCollator.compare(a.item.label, b.item.label) || resultKey(a).localeCompare(resultKey(b)));
  return { prepared, items };
}

function refreshResults(updateGroupOptions = false): void {
  if (options.directory.mapExtentOnly && !ready) return;
  let { prepared, items } = results();
  if (updateGroupOptions && focusedGroup && !prepared.some(g => g.group.id === focusedGroup)) { focusedGroup = ""; items = results().items; }
  $("group-scope").hidden = !focusedGroup;
  text("focused-group-label", prepared.find(g => g.group.id === focusedGroup)?.group.label ?? "");
  $("loading-message").hidden = true;
  const pages = Math.max(1, Math.ceil(items.length / pageSize)); page = Math.min(page, pages - 1);
  text("result-count", String(items.length));
  $<HTMLCalciteChipElement>("result-count").label = t(items.length === 1 ? "1 community" : "{count} communities", { count: items.length });
  const matching = prepared.reduce((sum, g) => sum + g.counts.matching, 0);
  text("map-count", t(options.directory.mapExtentOnly ? "{groups} groups in view · {items} communities" : "{groups} groups · {items} communities", { groups: prepared.length, items: matching }));
  updateLevelLabel();
  resultList.render(items.slice(page * pageSize, (page + 1) * pageSize).map(result => ({
    key: resultKey(result), label: result.item.label, image: result.item.image,
    description: `${categoryLabel(result.item.category)} · ${result.group?.group.label ?? t("Not shown on the map")}`,
    activate: () => showItem(result.item, result.group),
  })), t(options.directory.mapExtentOnly ? "No matches in this area. Move the map or turn off “Only the visible area”." : "No matches. Try another term or clear the filters."));
  text("page-info", `${page + 1} / ${pages}`);
  $<HTMLCalciteButtonElement>("previous").disabled = page === 0;
  $<HTMLCalciteButtonElement>("next").disabled = page >= pages - 1;
  urlHistory?.schedule();
  const itemGroups = prepared.filter(g => g.counts.displayed > 0);
  const hasCounts = prepared.some(g => g.group.presentation === "count");
  const categories = [...new Set(itemGroups.flatMap(g => g.matching.map(i => i.category)))].slice(0, 4);
  const signature = JSON.stringify([language(), hasCounts, categories]);
  if (signature === legendSignature) return;
  legendSignature = signature;
  const legend = $("legend"); legend.replaceChildren();
  if (hasCounts) { const note = document.createElement("span"); note.className = "legend-item"; note.textContent = t("N = matching communities"); legend.append(note); }
  for (const category of categories) {
    const item = document.createElement("span"), dot = document.createElement("span"); item.className = "legend-item"; dot.className = "legend-dot"; dot.style.background = colors[category] ?? "#64748b";
    item.append(dot, document.createTextNode(categoryLabel(category))); legend.append(item);
  }
}

function showItem(item: GroupItem, prepared?: PreparedGroup): void {
  closeMapTooltip();
  if (prepared) { if (options.activation.emphasizeOnItemClick) layer.selectTerritory(prepared.group.territoryId); placeInfo(prepared.group.label, true); }
  showDetails(item, prepared, categoryNames[item.category] ?? item.category, dataset === "communities" ? data.features.find(f => f.properties.sourceId === item.sourceId)?.properties.status : undefined);
}

function activate(event: Activation): void {
  closeMapTooltip();
  if (event.type === "item") { showItem(event.item, { group: event.group, counts: event.counts, matching: [], cells: [] }); return; }
  focusedGroup = event.groupId; page = 0;
  openDirectory();
  $<HTMLCalciteFlowItemElement>("details").selected = false;
  $<HTMLCalciteFlowItemElement>("directory-panel").selected = true;
  placeInfo(event.group.label, true);
  if (options.activation.emphasizeOnGroupAction) layer.selectTerritory(event.group.territoryId);
  refreshResults();
  $("explore").focus();
  if (event.group.presentation === "count") {
    wheelNavigation?.cancel();
    void mapElement.goTo({ center: [event.group.anchor.x, event.group.anchor.y], zoom: Math.max(mapElement.zoom + 1.5, level === "region" ? 6.8 : 9.5) }, { animate: !matchMedia("(prefers-reduced-motion: reduce)").matches }).catch(handleNavigation);
  }
  // Inspection is the group action. It does not implicitly expand or change zoom.
}
layer.onActivate(activate);

async function goHome(): Promise<void> {
  if (!ready) return;
  wheelNavigation?.cancel();
  const target = dataset === "communities"
    ? { target: new Extent({ xmin: -18.3, ymin: 27.4, xmax: 4.6, ymax: 44, spatialReference: SpatialReference.WGS84 }), rotation: 0 }
    : { center: [-5, 38.5], zoom: dataset === "reference" ? 4.3 : 5.1, rotation: 0 };
  await mapElement.goTo(target, { animate: !matchMedia("(prefers-reduced-motion: reduce)").matches }).catch(handleNavigation);
}
function handleNavigation(error: unknown): void {
  if (!isAbortError(error) && (error as { name?: string } | null)?.name !== "view:goto-interrupted") console.error(error);
}

$("search").addEventListener("calciteInputInput", () => { applyFilters(); urlHistory?.updateSearch(); });
$("search").addEventListener("focusout", event => {
  if (!(event.relatedTarget instanceof Node) || !$("search").contains(event.relatedTarget)) urlHistory?.finishSearch();
});
$("filters-toggle").addEventListener("click", () => urlHistory?.finishSearch());
$("search").addEventListener("keydown", event => { if (event.key === "Enter" && event.composedPath()[0] instanceof HTMLInputElement) { applyFilters(); urlHistory?.finishSearch(); urlHistory?.flush(); } });
$("apply-filters").addEventListener("click", () => { urlHistory?.finishSearch(); urlHistory?.flush(); });
for (const id of ["category", "status"]) $(id).addEventListener("calciteSelectChange", () => { urlHistory?.finishSearch(); applyFilters(); urlHistory?.flush(); });
$("clear-group").addEventListener("click", () => { focusedGroup = ""; page = 0; refreshResults(); });
$("boundaries").addEventListener("calciteSelectChange", () => configureDemo({ boundaries: { mode: select("boundaries").value as BoundaryMode } }));
$("boundary-names").addEventListener("calciteSwitchChange", () => configureDemo({ boundaries: { labels: $<HTMLCalciteSwitchElement>("boundary-names").checked } }));
$("boundary-click").addEventListener("calciteSelectChange", () => configureDemo({ boundaries: { clickAction: select("boundary-click").value as BoundaryClickAction } }));
$("smooth-wheel").addEventListener("calciteSwitchChange", () => configureDemo({ navigation: { smoothWheelZoom: $<HTMLCalciteSwitchElement>("smooth-wheel").checked } }));
$("wheel-input").addEventListener("calciteSelectChange", () => configureDemo({ navigation: { inputMode: select("wheel-input").value as "auto" | "mouse" | "trackpad" } }));
$("visible-results").addEventListener("calciteSwitchChange", () => configureDemo({ directory: { mapExtentOnly: $<HTMLCalciteSwitchElement>("visible-results").checked } }));
async function withFilterNavigation(work: (current: () => boolean) => Promise<void>): Promise<void> {
  const epoch = ++navigationEpoch;
  filterNavigation = true;
  try { await work(() => epoch === navigationEpoch); }
  catch (error) { handleNavigation(error); }
  finally { if (epoch === navigationEpoch) { filterNavigation = false; urlHistory?.flush(); } }
}
$("territory").addEventListener("calciteSelectChange", () => void withFilterNavigation(async current => {
  const id = select("territory").value;
  layer.selectTerritory(); focusedGroup = ""; select("province").value = ""; updateProvinces(); applyFilters();
  if (!id && ready && dataset === "communities") { await goHome(); return; }
  if (id && ready && dataset === "communities") {
    const all = await territories.queryFeatures(territories.createQuery());
    if (!current() || select("territory").value !== id || select("province").value || dataset !== "communities") return;
    const feature = all.features.find(f => f.attributes.id === id);
    if (feature?.geometry) {
      wheelNavigation?.cancel();
      await mapElement.goTo({ target: feature.geometry.extent?.clone().expand(1.3) }, { animate: !matchMedia("(prefers-reduced-motion: reduce)").matches }).catch(handleNavigation);
    }
  }
}));
$("province").addEventListener("calciteSelectChange", () => void withFilterNavigation(async () => {
  focusedGroup = ""; applyFilters();
  const id = select("province").value;
  if (!id || !ready) return;
  const coordinates = data.features.filter(f => f.geometry && f.properties.provinceId === id).map(f => f.geometry!.coordinates);
  if (!coordinates.length) return;
  const xs = coordinates.map(c => c[0]), ys = coordinates.map(c => c[1]);
  const extent = new Extent({ xmin: Math.min(...xs) - 0.15, xmax: Math.max(...xs) + 0.15, ymin: Math.min(...ys) - 0.15, ymax: Math.max(...ys) + 0.15, spatialReference: SpatialReference.WGS84 });
  wheelNavigation?.cancel();
  await mapElement.goTo({ target: extent.expand(1.4) }, { animate: !matchMedia("(prefers-reduced-motion: reduce)").matches }).catch(handleNavigation);
}));
$("dataset").addEventListener("calciteSelectChange", () => void withFilterNavigation(async () => {
  dataset = select("dataset").value; select("category").value = ""; select("status").value = dataset === "communities" ? "active" : ""; select("territory").value = ""; select("province").value = ""; updateProvinces();
  layer.selectTerritory(); placeInfo("", true);
  updateData(); await goHome();
}));
$("variant").addEventListener("calciteSelectChange", () => updateData());
$("grouping").addEventListener("calciteSelectChange", () => { grouping = select("grouping").value as "auto" | Grouping; level = resolveLevel(grouping, mapElement.zoom, level); updateData(); });
$("visibility").addEventListener("calciteSwitchChange", () => { layer.visible = $<HTMLCalciteSwitchElement>("visibility").checked; });
$("opacity").addEventListener("calciteSliderInput", () => { layer.opacity = Number($<HTMLCalciteSliderElement>("opacity").value) / 100; });
$("previous").addEventListener("click", () => { page--; refreshResults(); });
$("next").addEventListener("click", () => { page++; refreshResults(); });
$("reset").addEventListener("click", () => {
  $<HTMLCalciteInputElement>("search").value = "";
  for (const id of ["category", "status", "territory", "province"]) select(id).value = "";
  focusedGroup = ""; updateProvinces(); layer.selectTerritory(); placeInfo("", true); applyFilters(); urlHistory?.flush();
});
$("reattach").addEventListener("click", () => {
  if (attached) { mapElement.map!.remove(layer); attached = false; $("reattach").textContent = t("Add layer again"); }
  else { mapElement.map!.add(layer); attached = true; $("reattach").textContent = t("Remove layer"); }
});

const abort = new AbortController();
window.addEventListener("pagehide", () => abort.abort(), { once: true });
window.addEventListener("pagehide", () => referenceHandle.remove(), { once: true });
window.addEventListener("pagehide", () => wheelNavigation?.destroy(), { once: true });
window.addEventListener("pagehide", () => clearTimeout(mapRefreshTimer), { once: true });
window.addEventListener("pagehide", () => urlHistory?.destroy(), { once: true });
function captureSharedState(): SharedState {
  const center = mapElement.view.center;
  const point = center.spatialReference.isWGS84 ? center : webMercatorUtils.webMercatorToGeographic(center) as Point;
  return {
    language: language(), search: $<HTMLCalciteInputElement>("search").value, category: select("category").value,
    status: select("status").value as SharedState["status"], region: select("territory").value,
    province: select("province").value, group: focusedGroup, visibleOnly: options.directory.mapExtentOnly,
    dataset: dataset as SharedState["dataset"], grouping, level, variant: select("variant").value as SharedState["variant"],
    view: {
      longitude: ((point.x + 180) % 360 + 360) % 360 - 180, latitude: point.y,
      scale: mapElement.view.scale, rotation: mapElement.view.rotation,
      width: mapElement.view.width, height: mapElement.view.height,
    },
  };
}
function restoreSelect(id: string, value: string): void {
  const el = select(id);
  el.value = [...el.querySelectorAll("calcite-option")].some(o => o.value === value) ? value : "";
}
async function restoreSharedState(state: SharedState): Promise<void> {
  const epoch = ++restoreEpoch;
  ++navigationEpoch; filterNavigation = false;
  clearTimeout(mapRefreshTimer); wheelNavigation?.cancel(); closeMapTooltip();
  changeLanguage(state.language);
  dataset = state.dataset; select("dataset").value = dataset;
  grouping = state.grouping; select("grouping").value = grouping; level = state.level;
  select("variant").value = state.variant;
  for (const id of ["category", "territory", "province"]) select(id).value = "";
  updateData();
  restoreSelect("category", state.category); restoreSelect("status", state.status);
  restoreSelect("territory", state.region); updateProvinces(); restoreSelect("province", state.province);
  $<HTMLCalciteInputElement>("search").value = state.search;
  configureDemo({ directory: { mapExtentOnly: state.visibleOnly } });
  layer.selectTerritory(); placeInfo("", true); applyFilters();
  $<HTMLCalciteFlowItemElement>("details").selected = false;
  $<HTMLCalciteFlowItemElement>("directory-panel").selected = true;
  async function settleViewport(): Promise<boolean> {
    let stable = 0, previousSize = "";
    for (let i = 0; i < 40 && stable < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 25));
      if (epoch !== restoreEpoch) return false;
      const width = mapElement.clientWidth, height = mapElement.clientHeight;
      const size = `${width}:${height}`;
      const matches = Math.abs(mapElement.view.width - width) <= 1 && Math.abs(mapElement.view.height - height) <= 1;
      stable = matches && size === previousSize ? stable + 1 : 0; previousSize = size;
    }
    return epoch === restoreEpoch;
  }
  // Fitting may change the adaptive legend, which resizes the viewport again.
  // Always refit from the original shared footprint, never from a previously fitted scale.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (state.view) {
      if (!await settleViewport()) return;
      await mapElement.goTo({ center: [state.view.longitude, state.view.latitude], scale: restoredScale(state.view, mapElement.view.width, mapElement.view.height), rotation: state.view.rotation }, { animate: false }).catch(handleNavigation);
    }
    if (epoch !== restoreEpoch) return;
    level = resolveLevel(grouping, mapElement.zoom, state.level); updateData(true);
    focusedGroup = groups.some(g => g.id === state.group) ? state.group : "";
    page = 0; applyAdaptivePresentation(); refreshResults(true);
    if (!state.view || !await settleViewport()) return;
    const fittedScale = restoredScale(state.view, mapElement.view.width, mapElement.view.height);
    if (Math.abs(mapElement.view.scale - fittedScale) < fittedScale * 1e-7) break;
  }
}
async function start(): Promise<void> {
  const responses = await Promise.all(["communities.geojson", "territories.geojson", "municipalities.geojson"].map(file => fetch(`${base}data/${file}`, { signal: abort.signal })));
  if (responses.some(response => !response.ok)) throw new Error(t("Could not load communities and territories"));
  [data, regionBoundaries, localBoundaries] = await Promise.all(responses.map(response => response.json()));
  updateData();
  await mapElement.viewOnReady(); ready = true;
  if (!initialSharedState.view) await goHome();
  await restoreSharedState(initialSharedState);
  await mapElement.view.whenLayerView(layer);
  wheelNavigation = new SmoothWheelZoom(mapElement.view, options.navigation, active => {
    if (active) closeMapTooltip();
    else scheduleMapRefresh();
  });
  reactiveUtils.watch(() => [layer.revision, layer.visible, layer.opacity, mapElement.map?.layers.includes(layer)], () => closeMapTooltip());
  updateBoundaries();
  reactiveUtils.watch(() => mapElement.zoom, zoom => {
    $("zoom-label").textContent = `Zoom ${zoom.toFixed(1)}`;
    updateBoundaries();
    const next = resolveLevel(grouping, zoom, level);
    if (dataset === "communities" && next !== level) { level = next; updateData(true); }
    else if ((zoom >= layer.config.detailZoom) !== previousDetail) scheduleMapRefresh();
    previousDetail = zoom >= layer.config.detailZoom;
  }, { initial: true });
  reactiveUtils.watch(() => mapElement.stationary, stationary => {
    if (!stationary) closeMapTooltip();
    if (stationary) scheduleMapRefresh();
  });
  reactiveUtils.watch(() => [mapElement.view.center.x, mapElement.view.center.y, mapElement.view.scale, mapElement.view.rotation, mapElement.view.width, mapElement.view.height], () => { scheduleMapRefresh(); urlHistory?.schedule(); });
  directoryOptionsChanged = () => { page = 0; refreshResults(true); };
  presentationOptionsChanged = scheduleMapRefresh;
  // LayerView's immediate-click handles item/overflow first; only background clicks reach this handler.
  mapElement.view.on("immediate-click", async event => {
    if (options.boundaries.clickAction === "none") return;
    const hits = await mapElement.view.hitTest(event, { include: [layer, territories, provinces, municipalities] });
    if (hits.results.some(hit => hit.layer === layer)) return;
    const territory = hits.results.find(hit => hit.type === "graphic" && hit.layer === territories);
    const local = hits.results.find(hit => hit.type === "graphic" && (hit.layer === municipalities || hit.layer === provinces));
    if (local?.type === "graphic") placeInfo(local.graphic.attributes.NAMEUNIT, true);
    if (territory?.type === "graphic" && dataset === "communities") {
      const id = territory.graphic.attributes.id as string;
      if (options.boundaries.clickAction === "select") {
        select("territory").value = id; select("province").value = ""; updateProvinces(); layer.selectTerritory(id); focusedGroup = ""; applyFilters();
      }
      if (!local) placeInfo(territory.graphic.attributes.name, true);
    }
  });
  let hoverSequence = 0;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  mapElement.view.on("pointer-move", event => {
    const sequence = ++hoverSequence;
    clearTimeout(hoverTimer);
    const target = { x: event.x, y: event.y };
    hoverTimer = setTimeout(async () => {
    if (!mapElement.stationary || wheelNavigation?.active) return;
    const epoch = tooltipEpoch;
    const hits = await mapElement.view.hitTest(target, { include: [layer, territories, provinces, municipalities] });
    if (sequence !== hoverSequence || epoch !== tooltipEpoch) return;
    const groupHit = hits.results.find(hit => hit.type === "graphic" && hit.layer === layer);
    if (groupHit?.type === "graphic") {
      const group = groups.find(g => g.id === groupHit.graphic.attributes.groupId);
      placeInfo(group?.label ?? pinnedPlace);
      const item = group?.items.find(i => i.id === groupHit.graphic.attributes.itemId);
      const point = groupHit.graphic.geometry ? mapElement.view.toScreen(groupHit.graphic.geometry as Point) : target;
      if (point && group) showMapTooltip(item?.label ?? `${group.label} · ${t("{count} communities", {count: groupHit.graphic.attributes.matching})}`, point.x, point.y);
      return;
    }
    closeMapTooltip();
    const boundaryHit = hits.results.find(hit => hit.type === "graphic" && (hit.layer === municipalities || hit.layer === provinces)) ?? hits.results.find(hit => hit.type === "graphic" && hit.layer === territories);
    placeInfo(boundaryHit?.type === "graphic" ? boundaryHit.graphic.attributes.NAMEUNIT ?? boundaryHit.graphic.attributes.name : pinnedPlace);
    }, 65);
  });
  mapElement.view.on("pointer-leave", () => { hoverSequence++; clearTimeout(hoverTimer); closeMapTooltip(); placeInfo(pinnedPlace); });
  urlHistory = new UrlHistory(captureSharedState, restoreSharedState, () => ready && mapElement.view.stationary && !wheelNavigation?.active && !filterNavigation);
  // Public demo API: fixed/automatic grouping and independent reusable layer.
  Object.assign(window, { groupDemo: { layer, mapElement, territories, provinces, municipalities, get wheelNavigation() { return wheelNavigation; }, configure: configureDemo, get options() { return structuredClone(options); }, setGrouping(mode: "auto" | Grouping) { select("grouping").value = mode; grouping = mode; level = resolveLevel(mode, mapElement.zoom, level); updateData(); }, get groups() { return groups; }, get data() { return data; } } });
}
const changeLanguage = setupInterface(() => {
  intl.setLocale(language());
  if (dataset !== "communities") updateData(true);
  document.title = t("SPAIN’S TECH COMMUNITY ECOSYSTEM");
  mapElement.aria = { label: t("Interactive tech community map"), description: t("Use the directory to inspect communities with the keyboard.") };
  setOptions("category", [...new Set(dataset === "communities" ? data.features.map(f => f.properties.communityType || "unknown") : groups.flatMap(g => g.items.map(i => i.category)))].sort().map(c => [c, categoryLabel(c)]), t("All types"));
  setOptions("territory", dataset === "communities" ? [...new Map(data.features.filter(f => f.properties.regionId).map(f => [f.properties.regionId!, f.properties.regionName!]))].sort((a,b)=>a[1].localeCompare(b[1],language())) : [], t("All of Spain"));
  updateProvinces(); updateFilterSummary(); updateBoundaries(); refreshResults(true);
  text("reattach", t(attached ? "Remove layer" : "Add layer again"));
  if (!apiKey) notice.textContent = t("Configure an API key to load the light gray basemap. Community symbols remain available.");
  urlHistory?.flush();
});
start().catch(error => { if (abort.signal.aborted) return; console.error(error); notice.hidden = false; notice.textContent = `${t("Unable to start the demo")}: ${error instanceof Error ? error.message : String(error)}`; $("loading-message").textContent = t("Data could not be loaded. Reload to try again."); });
