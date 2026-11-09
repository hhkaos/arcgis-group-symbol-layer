import Layer from "@arcgis/core/layers/Layer.js";
import BaseLayerView2D from "@arcgis/core/views/2d/layers/BaseLayerView2D.js";
import Point from "@arcgis/core/geometry/Point.js";
import Graphic from "@arcgis/core/Graphic.js";
import * as webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils.js";
import { property, subclass } from "@arcgis/core/core/accessorSupport/decorators.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type View from "@arcgis/core/views/View.js";
import type LayerView from "@arcgis/core/views/layers/LayerView.js";
import type { ViewHit } from "@arcgis/core/views/types.js";
import type { BaseLayerView2DProperties } from "@arcgis/core/views/2d/layers/BaseLayerView2D.js";
import type { RenderParameters } from "@arcgis/core/views/2d/layers/BaseLayerView2D.js";
import { activation, appearance, pick, prepareGroups, safeUrl, validateGroups } from "./model";
import type { Activation, Appearance, Cell, ItemFilter, PreparedGroup, ScreenCell, SymbolGroup } from "./model";

@subclass("grouped-symbols.GroupSymbolLayer")
export class GroupSymbolLayer extends Layer {
  @property() revision = 0;
  private groups: readonly SymbolGroup[] = [];
  private settings: Appearance = appearance();
  private filter?: ItemFilter;
  private selected?: string;
  private listeners = new Set<(event: Activation) => void>();

  constructor(options: { groups?: readonly SymbolGroup[]; appearance?: Partial<Appearance>; title?: string } = {}) {
    super({ title: options.title ?? "Grouped symbols" });
    this.settings = appearance(options.appearance);
    this.setData(options.groups ?? []);
  }

  setData(groups: readonly SymbolGroup[]): void {
    validateGroups(groups);
    // Own snapshot; view coordinates and images are never written to caller data.
    this.groups = groups.map(g => ({ ...g, anchor: { ...g.anchor }, items: g.items.map(i => ({ ...i })) }));
    this.revision++;
  }
  configure(options: Partial<Appearance>): void { this.settings = appearance({ ...this.settings, ...options }); this.revision++; }
  setFilter(filter?: ItemFilter): void { this.filter = filter; this.revision++; }
  selectTerritory(id?: string): void { this.selected = id; this.revision++; }
  get selectedTerritory(): string | undefined { return this.selected; }
  get config(): Readonly<Appearance> { return { ...this.settings, colors: { ...this.settings.colors } }; }
  getResults(zoom: number): PreparedGroup[] { return prepareGroups(this.groups, zoom, this.settings, this.filter); }
  onActivate(listener: (event: Activation) => void): { remove(): void } {
    this.listeners.add(listener);
    return { remove: () => this.listeners.delete(listener) };
  }
  activate(event: Activation): void { for (const listener of this.listeners) listener(event); }
  async createLayerView<T extends LayerView = LayerView>(view: View<T>): Promise<T> {
    const mapView = view as unknown as MapView;
    if (mapView.type !== "2d" || !(mapView.spatialReference.isWebMercator || mapView.spatialReference.isWGS84)) throw new Error("GroupSymbolLayer supports 2D WGS84 and Web Mercator views only");
    return new GroupSymbolLayerView({ view: mapView, layer: this }) as unknown as T;
  }
}

@subclass("grouped-symbols.GroupSymbolLayerView")
class GroupSymbolLayerView extends BaseLayerView2D {
  constructor(properties: BaseLayerView2DProperties & { view: MapView; layer: GroupSymbolLayer }) { super(properties); }
  private handles: { remove(): void }[] = [];
  private images = new Map<string, HTMLImageElement>();
  private active = false;
  private prepared: PreparedGroup[] = [];
  private preparedKey = "";
  private points = new Map<string, Point>();
  private projected = new Map<string, { x: number; y: number }>();
  private sprites = new Map<string, { canvas: HTMLCanvasElement; width: number; height: number }>();
  private spriteRatio = 0;
  private get source(): GroupSymbolLayer { return this.layer as GroupSymbolLayer; }

  attach(): void {
    this.active = true;
    this.handles.push(reactiveUtils.watch(() => [this.source.revision, this.source.opacity, this.source.visible], () => {
      this.preparedKey = "";
      this.dropUnusedImages();
      this.requestRender();
    }));
    this.handles.push(this.view.on("immediate-click", event => {
      if (!this.active || this.suspended || !this.visible || !this.source.visible || this.source.opacity <= 0) return;
      const hit = pick(this.screenCells(), event.x, event.y);
      if (!hit) return;
      event.stopPropagation();
      this.source.activate(activation(hit));
    }));
  }

  detach(): void {
    this.active = false;
    this.handles.forEach(h => h.remove());
    this.handles = [];
    for (const image of this.images.values()) { image.onload = null; image.onerror = null; image.src = ""; }
    this.images.clear(); this.points.clear(); this.projected.clear(); this.sprites.clear(); this.prepared = []; this.preparedKey = "";
  }

  private updatePrepared(): void {
    const a = this.source.config;
    const key = `${this.source.revision}:${this.view.zoom < a.detailZoom}`;
    if (key === this.preparedKey) return;
    this.preparedKey = key;
    this.prepared = this.source.getResults(this.view.zoom);
    this.sprites.clear();
    this.points.clear();
    this.projected.clear();
    for (const { group } of this.prepared) {
      let point = new Point({ x: group.anchor.x, y: group.anchor.y, spatialReference: { wkid: group.anchor.wkid } });
      if (this.view.spatialReference.isWebMercator && point.spatialReference.isWGS84) point = webMercatorUtils.geographicToWebMercator(point) as Point;
      else if (this.view.spatialReference.isWGS84 && point.spatialReference.isWebMercator) point = webMercatorUtils.webMercatorToGeographic(point) as Point;
      this.points.set(group.id, point);
      this.projected.set(group.id, { x: point.x, y: point.y });
    }
  }

  private screenCells(): ScreenCell[] {
    this.updatePrepared();
    const cells: ScreenCell[] = [];
    const placed = this.placeGroups(prepared => this.view.toScreen(this.points.get(prepared.group.id)!) ?? undefined, this.view.width, this.view.height);
    for (const { prepared, x: groupX, y: groupY } of placed) {
      for (const cell of prepared.cells) {
        const x = groupX + cell.x, y = groupY + cell.y;
        if (x + cell.size < 0 || y + cell.size < 0 || x - cell.size > this.view.width || y - cell.size > this.view.height) continue;
        cells.push({ x, y, cell, prepared });
      }
    }
    return cells;
  }

  private placeGroups(project: (group: PreparedGroup) => { x: number; y: number } | undefined, width: number, height: number): { prepared: PreparedGroup; x: number; y: number; anchorX: number; anchorY: number }[] {
    const placed = this.prepared.flatMap(prepared => {
      const point = project(prepared);
      return point ? [{ prepared, x: point.x, y: point.y, anchorX: point.x, anchorY: point.y }] : [];
    });
    if (!this.source.config.declutterCounts) return placed;
    const occupied: { x: number; y: number; width: number; height: number }[] = [];
    for (const p of placed.filter(p => p.prepared.group.presentation !== "count")) {
      occupied.push({ x: p.x, y: p.y, width: Math.max(...p.prepared.cells.map(c => Math.abs(c.x) + c.size / 2)) * 2, height: Math.max(...p.prepared.cells.map(c => Math.abs(c.y) + c.size / 2)) * 2 });
    }
    for (const p of placed.filter(p => p.prepared.group.presentation === "count")) {
      const size = p.prepared.cells[0].size;
      if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) continue;
      const offsets: [number, number][] = [[0, 0]];
      for (let ring = 1; ring <= 6; ring++) for (let step = 0; step < 12; step++) {
        const angle = step * Math.PI / 6;
        offsets.push([Math.cos(angle) * ring * (size + 5), Math.sin(angle) * ring * (size + 5)]);
      }
      for (const [dx, dy] of offsets) {
        const x = p.anchorX + dx, y = p.anchorY + dy;
        if (x < size / 2 + 4 || x > width - size / 2 - 4 || y < size / 2 + 4 || y > height - size / 2 - 28) continue;
        if (occupied.some(o => Math.abs(o.x - x) < (o.width + size) / 2 + 4 && Math.abs(o.y - y) < (o.height + size) / 2 + 4)) continue;
        p.x = x; p.y = y; break;
      }
      occupied.push({ x: p.x, y: p.y, width: size, height: size });
    }
    return placed;
  }

  private dropUnusedImages(): void {
    const urls = new Set(this.source.getResults(this.view.zoom).flatMap(g => g.matching.map(i => safeUrl(i.image))).filter(Boolean));
    for (const [url, image] of this.images) if (!urls.has(url)) {
      image.onload = null; image.onerror = null; image.src = ""; this.images.delete(url);
    }
  }

  private image(url?: string): HTMLImageElement | undefined {
    const clean = safeUrl(url);
    if (!clean) return;
    let image = this.images.get(clean);
    if (!image) {
      image = new Image(); image.crossOrigin = "anonymous"; image.decoding = "async";
      const current = image;
      image.onload = image.onerror = () => {
        if (this.active && this.images.get(clean) === current) { this.sprites.clear(); this.requestRender(); }
      };
      this.images.set(clean, image); image.src = clean;
    }
    return image.complete && image.naturalWidth ? image : undefined;
  }

  render(parameters: RenderParameters): void {
    const context = parameters.context;
    const ratio = parameters.pixelRatio;
    const source = this.source;
    const a = source.config;
    const selected = source.selectedTerritory;
    this.updatePrepared();
    if (ratio !== this.spriteRatio) { this.sprites.clear(); this.spriteRatio = ratio; }
    const state = parameters.state;
    const [viewWidth, viewHeight] = state.size;
    const worldWidth = this.view.spatialReference.isWebMercator ? 40075016.68557849 : 360;
    const screen: [number, number] = [0, 0];
    const placed = this.placeGroups(prepared => {
      const anchor = this.projected.get(prepared.group.id)!;
      const wrappedX = anchor.x + Math.round((state.center[0] - anchor.x) / worldWidth) * worldWidth;
      state.toScreen(screen, wrappedX, anchor.y);
      return { x: screen[0] / ratio, y: screen[1] / ratio };
    }, viewWidth, viewHeight);
    context.save(); context.scale(ratio, ratio);
    for (const p of placed) if (p.x !== p.anchorX || p.y !== p.anchorY) {
      context.globalAlpha = selected && p.prepared.group.territoryId !== selected ? a.attenuation : 0.8;
      context.beginPath(); context.moveTo(p.anchorX, p.anchorY); context.lineTo(p.x, p.y); context.strokeStyle = "#385b51"; context.lineWidth = 1; context.stroke();
      context.beginPath(); context.arc(p.anchorX, p.anchorY, 2, 0, Math.PI * 2); context.fillStyle = "#385b51"; context.fill();
    }
    for (const { prepared, x, y } of placed) {
      let sprite = this.sprites.get(prepared.group.id);
      if (!sprite) {
        const symbolWidth = 2 + Math.max(...prepared.cells.map(c => Math.abs(c.x) + c.size / 2)) * 2;
        const symbolHeight = 2 + Math.max(...prepared.cells.map(c => Math.abs(c.y) + c.size / 2)) * 2;
        const width = Math.max(symbolWidth, a.showLabels ? Math.min(150, prepared.group.label.length * 6 + 16) : 0);
        const height = symbolHeight + (a.showLabels ? 40 : 0);
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio);
        const offscreen = canvas.getContext("2d")!;
        offscreen.scale(ratio, ratio); offscreen.translate(width / 2, height / 2);
        for (const cell of prepared.cells) this.drawCell(offscreen, cell, prepared.group.variant, a);
        if (a.showLabels) {
          offscreen.font = "600 10px system-ui";
          let label = prepared.group.label;
          while (offscreen.measureText(label).width > width - 12 && label.length > 1) label = label.slice(0, -2) + "…";
          const textWidth = offscreen.measureText(label).width;
          const labelY = symbolHeight / 2 + 12;
          offscreen.fillStyle = "rgba(255,255,255,0.94)";
          offscreen.fillRect(-textWidth / 2 - 5, labelY - 8, textWidth + 10, 16);
          offscreen.fillStyle = "#234f4a"; offscreen.textAlign = "center"; offscreen.textBaseline = "middle";
          offscreen.fillText(label, 0, labelY);
        }
        sprite = { canvas, width, height }; this.sprites.set(prepared.group.id, sprite);
      }
      if (x + sprite.width / 2 < 0 || y + sprite.height / 2 < 0 || x - sprite.width / 2 > viewWidth || y - sprite.height / 2 > viewHeight) continue;
      // ArcGIS composites whole-layer opacity; only selection attenuation belongs here.
      context.globalAlpha = selected && prepared.group.territoryId !== selected ? a.attenuation : 1;
      context.drawImage(sprite.canvas, x - sprite.width / 2, y - sprite.height / 2, sprite.width, sprite.height);
    }
    context.restore();
  }

  private drawCell(context: CanvasRenderingContext2D, cell: Cell, variant: SymbolGroup["variant"], a: Readonly<Appearance>): void {
      const { x, y } = cell;
      const radius = cell.size / 2;
      const color = a.colors[cell.item?.category ?? ""] ?? a.defaultColor;
      context.save();
      context.beginPath(); context.arc(x, y, radius, 0, 2 * Math.PI);
      context.fillStyle = cell.overflow ? a.overflowColor : variant === "dots" ? color : "#fff";
      context.fill();
      if (!cell.overflow && variant === "images") {
        const image = this.image(cell.item?.image);
        context.save(); context.clip();
        if (image) {
          const available = cell.size - (cell.item?.imageFit === "cover" ? 0 : 10);
          const scale = (cell.item?.imageFit === "cover" ? Math.max : Math.min)(available / image.naturalWidth, available / image.naturalHeight);
          const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
          context.drawImage(image, x - width / 2, y - height / 2, width, height);
        } else {
          context.fillStyle = color; context.font = `600 ${Math.max(9, cell.size * 0.33)}px system-ui`;
          context.textAlign = "center"; context.textBaseline = "middle";
          context.fillText(cell.item?.label.slice(0, 2).toLocaleUpperCase() ?? "?", x, y);
        }
        context.restore();
        context.beginPath(); context.arc(x, y, Math.max(1, radius - 1.25), 0, 2 * Math.PI);
        context.lineWidth = 2.5; context.strokeStyle = color; context.stroke();
      }
      if (cell.overflow) {
        context.fillStyle = "#fff"; context.font = `600 ${cell.size * (cell.text ? 0.38 : 0.72)}px system-ui`;
        context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(cell.text ?? "+", x, y - (cell.text ? 0 : 1), cell.size - 4);
      }
      context.restore();
  }

  async hitTest(_mapPoint: Point, target: { x: number; y: number }): Promise<ViewHit[]> {
    if (!this.active || this.suspended || !this.visible || !this.source.visible || this.source.opacity <= 0) return [];
    const hit = pick(this.screenCells(), target.x, target.y);
    if (!hit) return [];
    const action = activation(hit);
    const point = this.view.toMap({ x: hit.x, y: hit.y });
    const graphic = new Graphic({ geometry: point, attributes: { type: action.type, groupId: action.groupId, itemId: action.type === "item" ? action.itemId : null, ...action.counts } });
    return [{ type: "graphic", graphic, layer: this.source, mapPoint: point }];
  }
}
