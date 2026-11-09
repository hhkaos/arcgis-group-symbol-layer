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
import "@esri/calcite-components/components/calcite-dialog";
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

let options = resolveDemoOptions(initialOptions);
let wheelNavigation: SmoothWheelZoom | undefined;
let directoryOptionsChanged: (() => void) | undefined;
let presentationOptionsChanged: (() => void) | undefined;

intl.setLocale("es");
const apiKey = import.meta.env.VITE_ARCGIS_API_KEY?.trim();
if (apiKey) esriConfig.apiKey = apiKey;
const mapElement = document.querySelector("arcgis-map")!;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const select = (id: string) => $<HTMLCalciteSelectElement>(id);
const resultList = new ResultList($("results"));
for (const [id, label] of Object.entries({ category: "Tipo de comunidad", status: "Estado de la comunidad", territory: "Territorio destacado", group: "Grupo para inspeccionar", dataset: "Conjunto de datos", grouping: "Nivel de agrupación", variant: "Representación de los grupos", boundaries: "Límites administrativos" })) select(id).label = label;
const base = import.meta.env.BASE_URL;
const colors: Record<string, string> = { "tech-meetup": "#167c72", conference: "#d69a36", hacklab: "#6d70b6", "collaborative-group": "#3c83ad", "umbrella-org": "#bc6b6b" };
const labels: Record<string, string> = { "tech-meetup": "Meetup", conference: "Conferencia", hacklab: "Hacklab", "collaborative-group": "Grupo colaborativo", "umbrella-org": "Organización", "meta-community": "Red de comunidades", "mutual-aid": "Apoyo mutuo", unknown: "Sin categoría" };
const layer = new GroupSymbolLayer({ title: "Comunidades", appearance: { colors, imageSize: 32, detailZoom: 9 } });
const regionSymbol = new SimpleFillSymbol({ color: [247, 247, 240, 0.2], outline: { color: [83, 114, 100, 0.9], width: 1.2 } });
const territories = new GeoJSONLayer({
  url: `${base}data/territories.geojson`, title: "Comunidades autónomas", objectIdField: "objectid", outFields: ["*"],
  popupEnabled: false, visible: options.boundaries.mode !== "none",
  renderer: { type: "simple", symbol: regionSymbol },
  labelingInfo: [{ labelExpressionInfo: { expression: "$feature.name" }, minScale: 12000000, symbol: { type: "text", color: "#526c5e", haloColor: "#ffffff", haloSize: 1.5, font: { size: 9, family: "Arial" } } }],
});
const adminBase = "https://services1.arcgis.com/nCKYwcSONQTkPA4K/arcgis/rest/services/";
const provinces = new FeatureLayer({ url: `${adminBase}Prov/FeatureServer/0`, title: "Provincias", visible: false, popupEnabled: false, outFields: ["NAMEUNIT", "NATCODE", "CODNUT2"], renderer: { type: "simple", symbol: { type: "simple-fill", color: [255,255,255,0], outline: { color: "#81907e", width: 0.9, style: "dash" } } }, labelingInfo: [{ labelExpressionInfo: { expression: "$feature.NAMEUNIT" }, symbol: { type: "text", color: "#526c5e", haloColor: "#fff", haloSize: 1.5, font: { size: 9 } } }] });
const municipalities = new FeatureLayer({ url: `${adminBase}muni/FeatureServer/0`, title: "Municipios", visible: false, minScale: 2000000, popupEnabled: false, outFields: ["NAMEUNIT", "NATCODE", "CODNUT2", "codine"], renderer: { type: "simple", symbol: { type: "simple-fill", color: [255,255,255,0], outline: { color: "#83998b", width: 0.65 } } }, labelingInfo: [{ minScale: 350000, labelExpressionInfo: { expression: "$feature.NAMEUNIT" }, symbol: { type: "text", color: "#3b5b4b", haloColor: "#fff", haloSize: 1.5, font: { size: 9 } } }] });
function updateBoundaries(): void {
  const mode = options.boundaries.mode;
  const names = options.boundaries.labels;
  territories.labelsVisible = names; provinces.labelsVisible = names; municipalities.labelsVisible = names;
  territories.visible = mode !== "none";
  provinces.visible = mode === "provinces" || mode === "auto" && mapElement.zoom >= 6.5 && mapElement.zoom < 8.5;
  municipalities.visible = mode === "municipalities" || mode === "auto" && mapElement.zoom >= 8.5;
  $("boundary-hint").textContent = mode === "none" ? "Los límites están ocultos. La agrupación territorial sigue disponible." : municipalities.visible && mapElement.scale > municipalities.minScale ? "Acércate para consultar los límites municipales." : options.boundaries.clickAction === "none" ? "El clic sobre los límites no realiza ninguna acción." : "Pulsa un límite para consultar su territorio.";
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
mapElement.aria = { label: "Mapa interactivo de comunidades tecnológicas", description: "Usa el directorio para consultar y activar todos los resultados con teclado." };
const notice = $("map-notice");
if (!apiKey) { notice.hidden = false; notice.textContent = "Configura la API key para cargar el mapa base gris claro. Los grupos siguen disponibles."; }
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
  const started = performance.now();
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
  setOptions("category", categories.map(c => [c, labels[c] ?? c]), "Todos los tipos");
  const regionNames = new Map<string, string>();
  for (const feature of data.features) if (feature.properties.regionId) regionNames.set(feature.properties.regionId, feature.properties.regionName!);
  setOptions("territory", dataset === "communities" ? [...regionNames].sort((a, b) => a[1].localeCompare(b[1], "es")) : [...new Set(groups.map(g => g.territoryId!))].map(id => [id, id]), "Toda España");
  if (preserveDirectory) { layer.setFilter(lastFilter); scheduleMapRefresh(); }
  else { focusedGroup = ""; select("group").value = ""; applyFilters(); }
  $("level-label").textContent = dataset !== "communities" ? dataset === "reference" ? "Casos de referencia" : "Carga de validación" : level === "region" ? "Por comunidad autónoma" : "Por localidad";
  $("timing").textContent = `Preparación: ${(performance.now() - started).toFixed(1)} ms · prototipo`;
}

function applyFilters(): void {
  clearTimeout(mapRefreshTimer);
  closeMapTooltip();
  const search = normalize($<HTMLCalciteInputElement>("search").value), category = select("category").value, status = select("status").value;
  const statusById = new Map(data.features.map(f => [f.properties.sourceId, f.properties.status]));
  lastFilter = item => (!category || item.category === category) && (!status || dataset !== "communities" || statusById.get(item.sourceId!) === status) && (!search || normalize(`${item.label} ${item.description ?? ""}`).includes(search));
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
    for (const f of data.features) if ((!f.geometry || !f.properties.displayOnMap) && (!lastFilter || lastFilter(communityItem(f.properties), { id: "unmapped", label: "Sin representación en el mapa", items: [], variant: "images", anchor: { x: 0, y: 0, wkid: 4326 } }))) items.push({ item: communityItem(f.properties), unmapped: true });
  }
  items.sort((a, b) => resultCollator.compare(a.item.label, b.item.label) || resultKey(a).localeCompare(resultKey(b)));
  return { prepared, items };
}

function refreshResults(updateGroupOptions = false): void {
  if (options.directory.mapExtentOnly && !ready) return;
  let { prepared, items } = results();
  if (updateGroupOptions) {
    const previousGroup = focusedGroup;
    const territory = select("territory").value;
    setOptions("group", [...prepared.filter(g => !territory || g.group.territoryId === territory).map(g => [g.group.id, `${g.group.label} (${g.counts.matching})`] as [string, string]), ...(dataset === "communities" && !territory && !options.directory.mapExtentOnly ? [["unmapped", "Sin representación en el mapa"] as [string, string]] : [])], "Todos los grupos");
    focusedGroup = select("group").value;
    if (focusedGroup !== previousGroup) items = results().items;
  }
  const pages = Math.max(1, Math.ceil(items.length / pageSize)); page = Math.min(page, pages - 1);
  text("result-count", String(items.length));
  const matching = prepared.reduce((sum, g) => sum + g.counts.matching, 0), hidden = prepared.reduce((sum, g) => sum + g.counts.hidden, 0);
  text("map-count", `${prepared.length} grupos${options.directory.mapExtentOnly ? " en vista" : ""} · ${matching} comunidades`);
  const target = prepared.find(g => g.group.id === focusedGroup);
  text("result-context", target ? `${target.counts.total} en el grupo · ${target.counts.matching} coinciden · ${target.counts.displayed} visibles · ${target.counts.hidden} resumidas` : `${options.directory.mapExtentOnly ? "Resultados de los grupos en el área visible. " : ""}${hidden} coincidencias resumidas; disponibles en el directorio.`);
  resultList.render(items.slice(page * pageSize, (page + 1) * pageSize).map(result => ({
    key: resultKey(result), label: result.item.label, image: result.item.image,
    description: `${labels[result.item.category] ?? result.item.category} · ${result.group?.group.label ?? "Sin representación en el mapa"}`,
    activate: () => showItem(result.item, result.group),
  })), options.directory.mapExtentOnly ? "No hay coincidencias en esta área. Mueve el mapa o desactiva «Solo el área visible»." : "No hay coincidencias. Prueba otro término o limpia los filtros.");
  text("page-info", `${page + 1} / ${pages}`);
  $<HTMLCalciteButtonElement>("previous").disabled = page === 0;
  $<HTMLCalciteButtonElement>("next").disabled = page >= pages - 1;
  const itemGroups = prepared.filter(g => g.counts.displayed > 0);
  const hasCounts = prepared.some(g => g.group.presentation === "count");
  const categories = [...new Set(itemGroups.flatMap(g => g.matching.map(i => i.category)))].slice(0, 4);
  const signature = JSON.stringify([hasCounts, categories]);
  if (signature === legendSignature) return;
  legendSignature = signature;
  const legend = $("legend"); legend.replaceChildren();
  if (hasCounts) { const note = document.createElement("span"); note.className = "legend-item"; note.textContent = "N = comunidades que coinciden"; legend.append(note); }
  for (const category of categories) {
    const item = document.createElement("span"), dot = document.createElement("span"); item.className = "legend-item"; dot.className = "legend-dot"; dot.style.background = colors[category] ?? "#64748b";
    item.append(dot, document.createTextNode(labels[category] ?? category)); legend.append(item);
  }
}

function showItem(item: GroupItem, prepared?: PreparedGroup): void {
  closeMapTooltip();
  if (prepared) { if (options.activation.emphasizeOnItemClick) layer.selectTerritory(prepared.group.territoryId); placeInfo(prepared.group.label, true); }
  const dialog = $<HTMLCalciteDialogElement>("details"); dialog.heading = item.label;
  const container = $("details-content"); container.replaceChildren();
  const url = safeUrl(item.image);
  if (url) { const img = document.createElement("img"); img.className = "detail-image"; img.alt = item.label; img.src = url; img.onerror = () => img.remove(); container.append(img); }
  const meta = document.createElement("p"); meta.className = "detail-meta"; meta.textContent = `${labels[item.category] ?? item.category} · ${prepared?.group.label ?? "Sin representación en el mapa"}`;
  const description = document.createElement("p"); description.textContent = item.description ?? "Sin descripción adicional.";
  container.append(meta, description);
  if (prepared) { const identity = document.createElement("p"); identity.className = "muted"; identity.textContent = `Grupo: ${prepared.group.id} · Elemento: ${item.id}${item.sourceId ? ` · Origen: ${item.sourceId}` : ""}`; container.append(identity); }
  const linkUrl = safeUrl(item.url);
  if (linkUrl) { const link = document.createElement("a"); link.href = linkUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Visitar la comunidad ↗"; container.append(link); }
  dialog.open = true;
}

function activate(event: Activation): void {
  closeMapTooltip();
  if (event.type === "item") { showItem(event.item, { group: event.group, counts: event.counts, matching: [], cells: [] }); return; }
  focusedGroup = event.groupId; select("group").value = focusedGroup; page = 0;
  placeInfo(event.group.label, true);
  if (options.activation.emphasizeOnGroupAction) layer.selectTerritory(event.group.territoryId);
  select("territory").value = event.group.territoryId ?? "";
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

$("search").addEventListener("calciteInputInput", applyFilters);
for (const id of ["category", "status"]) $(id).addEventListener("calciteSelectChange", applyFilters);
$("group").addEventListener("calciteSelectChange", () => {
  focusedGroup = select("group").value;
  const group = groups.find(g => g.id === focusedGroup);
  if (options.activation.emphasizeOnGroupAction) layer.selectTerritory(group?.territoryId ?? (select("territory").value || undefined));
  page = 0; refreshResults();
  placeInfo(group?.label ?? "", true);
});
$("boundaries").addEventListener("calciteSelectChange", () => configureDemo({ boundaries: { mode: select("boundaries").value as BoundaryMode } }));
$("boundary-names").addEventListener("calciteSwitchChange", () => configureDemo({ boundaries: { labels: $<HTMLCalciteSwitchElement>("boundary-names").checked } }));
$("boundary-click").addEventListener("calciteSelectChange", () => configureDemo({ boundaries: { clickAction: select("boundary-click").value as BoundaryClickAction } }));
$("smooth-wheel").addEventListener("calciteSwitchChange", () => configureDemo({ navigation: { smoothWheelZoom: $<HTMLCalciteSwitchElement>("smooth-wheel").checked } }));
$("wheel-input").addEventListener("calciteSelectChange", () => configureDemo({ navigation: { inputMode: select("wheel-input").value as "auto" | "mouse" | "trackpad" } }));
$("visible-results").addEventListener("calciteSwitchChange", () => configureDemo({ directory: { mapExtentOnly: $<HTMLCalciteSwitchElement>("visible-results").checked } }));
$("territory").addEventListener("calciteSelectChange", async () => {
  const id = select("territory").value;
  layer.selectTerritory(id || undefined); focusedGroup = ""; select("group").value = ""; page = 0; refreshResults(true);
  if (id && ready && dataset === "communities") {
    const query = territories.createQuery(); query.where = "1=1";
    const all = await territories.queryFeatures(query);
    if (select("territory").value !== id || dataset !== "communities") return;
    const feature = all.features.find(f => f.attributes.id === id);
    if (feature?.geometry) {
      wheelNavigation?.cancel();
      await mapElement.goTo({ target: feature.geometry.extent?.clone().expand(1.3) }, { animate: !matchMedia("(prefers-reduced-motion: reduce)").matches }).catch(handleNavigation);
    }
  }
});
$("dataset").addEventListener("calciteSelectChange", () => {
  dataset = select("dataset").value; select("category").value = ""; select("status").value = dataset === "communities" ? "active" : ""; select("territory").value = "";
  layer.selectTerritory(); placeInfo("", true);
  updateData(); void goHome();
});
$("variant").addEventListener("calciteSelectChange", () => updateData());
$("grouping").addEventListener("calciteSelectChange", () => { grouping = select("grouping").value as "auto" | Grouping; level = resolveLevel(grouping, mapElement.zoom, level); updateData(); });
$("visibility").addEventListener("calciteSwitchChange", () => { layer.visible = $<HTMLCalciteSwitchElement>("visibility").checked; });
$("opacity").addEventListener("calciteSliderInput", () => { layer.opacity = Number($<HTMLCalciteSliderElement>("opacity").value) / 100; });
$("settings-toggle").addEventListener("click", () => { const settings = $("settings"); settings.hidden = !settings.hidden; $("settings-toggle").setAttribute("aria-expanded", String(!settings.hidden)); });
$("settings").addEventListener("keydown", e => { if (e.key === "Escape") { $("settings").hidden = true; $("settings-toggle").setAttribute("aria-expanded", "false"); $("settings-toggle").focus(); } });
$("previous").addEventListener("click", () => { page--; refreshResults(); });
$("next").addEventListener("click", () => { page++; refreshResults(); });
$("home").addEventListener("click", () => void goHome());
$("reset").addEventListener("click", () => {
  $<HTMLCalciteInputElement>("search").value = "";
  for (const id of ["category", "status", "territory", "group"]) select(id).value = "";
  focusedGroup = ""; layer.selectTerritory(); placeInfo("", true); applyFilters();
});
$("reattach").addEventListener("click", () => {
  if (attached) { mapElement.map!.remove(layer); attached = false; $("reattach").textContent = "Volver a añadir capa"; }
  else { mapElement.map!.add(layer); attached = true; $("reattach").textContent = "Retirar y volver a añadir capa"; }
});

const abort = new AbortController();
window.addEventListener("pagehide", () => abort.abort(), { once: true });
window.addEventListener("pagehide", () => referenceHandle.remove(), { once: true });
window.addEventListener("pagehide", () => wheelNavigation?.destroy(), { once: true });
window.addEventListener("pagehide", () => clearTimeout(mapRefreshTimer), { once: true });
async function start(): Promise<void> {
  const responses = await Promise.all(["communities.geojson", "territories.geojson", "municipalities.geojson"].map(file => fetch(`${base}data/${file}`, { signal: abort.signal })));
  if (responses.some(response => !response.ok)) throw new Error("No se pudieron cargar las comunidades y sus territorios");
  [data, regionBoundaries, localBoundaries] = await Promise.all(responses.map(response => response.json()));
  updateData();
  await mapElement.viewOnReady(); ready = true;
  await goHome();
  updateData();
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
  reactiveUtils.watch(() => [mapElement.view.center.x, mapElement.view.center.y, mapElement.view.scale, mapElement.view.rotation, mapElement.view.width, mapElement.view.height], scheduleMapRefresh);
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
        select("territory").value = id; layer.selectTerritory(id); focusedGroup = ""; select("group").value = ""; page = 0; refreshResults();
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
    if (!mapElement.stationary || wheelNavigation?.active || $<HTMLCalciteDialogElement>("details").open) return;
    const epoch = tooltipEpoch;
    const hits = await mapElement.view.hitTest(target, { include: [layer, territories, provinces, municipalities] });
    if (sequence !== hoverSequence || epoch !== tooltipEpoch || $<HTMLCalciteDialogElement>("details").open) return;
    const groupHit = hits.results.find(hit => hit.type === "graphic" && hit.layer === layer);
    if (groupHit?.type === "graphic") {
      const group = groups.find(g => g.id === groupHit.graphic.attributes.groupId);
      placeInfo(group?.label ?? pinnedPlace);
      const item = group?.items.find(i => i.id === groupHit.graphic.attributes.itemId);
      const point = groupHit.graphic.geometry ? mapElement.view.toScreen(groupHit.graphic.geometry as Point) : target;
      if (point && group) showMapTooltip(item?.label ?? `${group.label} · ${groupHit.graphic.attributes.matching} comunidades`, point.x, point.y);
      return;
    }
    closeMapTooltip();
    const boundaryHit = hits.results.find(hit => hit.type === "graphic" && (hit.layer === municipalities || hit.layer === provinces)) ?? hits.results.find(hit => hit.type === "graphic" && hit.layer === territories);
    placeInfo(boundaryHit?.type === "graphic" ? boundaryHit.graphic.attributes.NAMEUNIT ?? boundaryHit.graphic.attributes.name : pinnedPlace);
    }, 65);
  });
  mapElement.view.on("pointer-leave", () => { hoverSequence++; clearTimeout(hoverTimer); closeMapTooltip(); placeInfo(pinnedPlace); });
  // Public demo API: fixed/automatic grouping and independent reusable layer.
  Object.assign(window, { groupDemo: { layer, mapElement, territories, provinces, municipalities, get wheelNavigation() { return wheelNavigation; }, configure: configureDemo, get options() { return structuredClone(options); }, setGrouping(mode: "auto" | Grouping) { select("grouping").value = mode; grouping = mode; level = resolveLevel(mode, mapElement.zoom, level); updateData(); }, get groups() { return groups; }, get data() { return data; } } });
}
start().catch(error => { if (abort.signal.aborted) return; console.error(error); notice.hidden = false; notice.textContent = `No se puede iniciar la demo: ${error instanceof Error ? error.message : String(error)}`; $("result-context").textContent = "No se han podido cargar los datos. Recarga para volver a intentarlo."; });
