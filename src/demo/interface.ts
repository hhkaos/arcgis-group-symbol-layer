import { safeUrl } from "../layer/model";
import type { GroupItem, PreparedGroup } from "../layer/model";
import { language, localize, setLanguage, t } from "./i18n";
import type { Language } from "./i18n";

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let selected: { item: GroupItem; group?: PreparedGroup; category: string; status?: string } | undefined;
let returnFocus: HTMLElement | undefined;
export function openDirectory(): void {
  byId<HTMLCalciteShellPanelElement>("sidebar").collapsed = false;
  byId("sidebar-toggle").setAttribute("aria-expanded", "true");
  if (matchMedia("(max-width: 700px)").matches) {
    byId<HTMLCalciteShellPanelElement>("settings-shell").collapsed = true;
    byId("settings-toggle").setAttribute("aria-expanded", "false");
  }
}
export function showDetails(item: GroupItem, group: PreparedGroup | undefined, category: string, status?: string): void {
  const details = byId<HTMLCalciteFlowItemElement>("details");
  const opening = !details.selected;
  if (opening) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  selected = { item, group, category, status };
  openDirectory();
  renderDetails();
  byId<HTMLCalciteFlowItemElement>("directory-panel").selected = false;
  details.selected = true;
  // Wait for the newly selected Flow item to render before focusing its back action.
  if (opening) requestAnimationFrame(() => { void details.setFocus(); });
}
function renderDetails(): void {
  if (!selected) return;
  const { item, group, category, status } = selected;
  const details = byId<HTMLCalciteFlowItemElement>("details"); details.heading = item.label;
  const container = byId("details-content"); container.replaceChildren();
  const image = safeUrl(item.image);
  if (image) {
    const img = document.createElement("img"); img.className = "detail-image"; img.alt = item.label; img.src = image;
    img.onerror = () => img.remove(); container.append(img);
  }
  const meta = document.createElement("p"); meta.className = "detail-meta";
  meta.textContent = `${t(category)} · ${group?.group.label ?? t("Not shown on the map")}`;
  const description = document.createElement("p"); description.textContent = item.description || t("No description available.");
  container.append(meta, description);
  if (status) {
    const chip = document.createElement("calcite-chip"); chip.scale = "s";
    chip.textContent = t(status === "active" ? "Active community" : status === "inactive" ? "Inactive community" : "Unconfirmed");
    const statusLine = document.createElement("p"); statusLine.append(chip); container.append(statusLine);
  }
  const url = safeUrl(item.url);
  if (url) {
    const link = document.createElement("calcite-button"); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
    link.iconEnd = "launch"; link.textContent = t("Visit community"); container.append(link);
  }
}
export function setupInterface(onLanguageChange: () => void): (value: Language) => void {
  const sidebar = byId<HTMLCalciteShellPanelElement>("sidebar"), settings = byId<HTMLCalciteShellPanelElement>("settings-shell");
  const filters = byId<HTMLCalciteBlockElement>("filters");
  const filterAction = byId<HTMLCalciteButtonElement>("filters-toggle");
  function syncFilters(): void {
    filters.hidden = !filters.expanded;
    filterAction.appearance = filters.expanded ? "solid" : "outline";
    filterAction.kind = filters.expanded ? "brand" : "neutral";
    filterAction.setAttribute("aria-expanded", String(filters.expanded));
    filterAction.label = t(filters.expanded ? "Hide filters" : "Show filters");
  }
  filterAction.addEventListener("click", () => { filters.expanded = !filters.expanded; syncFilters(); });
  filters.addEventListener("calciteBlockToggle", () => {
    syncFilters();
    if (!filters.expanded) void filterAction.setFocus();
  });
  const media = matchMedia("(max-width: 700px)");
  const adapt = () => { sidebar.displayMode = media.matches ? "overlay" : "dock"; sidebar.resizable = !media.matches; settings.displayMode = "overlay"; };
  adapt(); sidebar.collapsed = media.matches;
  byId("sidebar-toggle").setAttribute("aria-expanded", String(!sidebar.collapsed));
  media.addEventListener("change", adapt);
  document.querySelector(".skip-link")?.addEventListener("click", event => {
    event.preventDefault(); openDirectory();
    byId<HTMLCalciteFlowItemElement>("details").selected = false;
    byId<HTMLCalciteFlowItemElement>("directory-panel").selected = true;
    requestAnimationFrame(() => byId("explore").focus());
  });
  byId("sidebar-toggle").addEventListener("click", () => {
    sidebar.collapsed = !sidebar.collapsed;
    byId("sidebar-toggle").setAttribute("aria-expanded", String(!sidebar.collapsed));
    if (media.matches && !sidebar.collapsed) closeSettings();
  });
  function closeSettings(): void {
    settings.collapsed = true; byId("settings-toggle").setAttribute("aria-expanded", "false");
  }
  byId("settings-toggle").addEventListener("click", () => {
    const panel = byId<HTMLCalcitePanelElement>("settings"); panel.closed = false;
    settings.collapsed = !settings.collapsed;
    byId("settings-toggle").setAttribute("aria-expanded", String(!settings.collapsed));
    if (!settings.collapsed) {
      if (media.matches) { sidebar.collapsed = true; byId("sidebar-toggle").setAttribute("aria-expanded", "false"); }
      void panel.setFocus();
    }
  });
  byId("settings").addEventListener("calcitePanelClose", () => { closeSettings(); void byId<HTMLCalciteButtonElement>("settings-toggle").setFocus(); });
  byId("settings").addEventListener("keydown", event => { if (event.key === "Escape") { closeSettings(); void byId<HTMLCalciteButtonElement>("settings-toggle").setFocus(); } });
  byId("apply-filters").addEventListener("click", () => { filters.expanded = false; syncFilters(); byId("explore").focus(); });
  byId<HTMLCalciteFlowItemElement>("details").beforeBack = async () => {
    requestAnimationFrame(() => requestAnimationFrame(() => (returnFocus?.isConnected ? returnFocus : byId("explore")).focus({ preventScroll: true })));
  };
  byId("details").addEventListener("keydown", event => { if (event.key === "Escape") void byId<HTMLCalciteFlowElement>("directory-flow").back(); });
  const changeLanguage = (value: Language) => {
    setLanguage(value); byId<HTMLCalciteSelectElement>("language").value = value;
    localize(); syncFilters(); renderDetails(); onLanguageChange();
  };
  byId("language").addEventListener("calciteSelectChange", () => {
    changeLanguage(byId<HTMLCalciteSelectElement>("language").value === "es" ? "es" : "en");
  });
  byId<HTMLCalciteSelectElement>("language").value = language(); localize(); syncFilters();
  return changeLanguage;
}
