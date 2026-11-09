# Spain’s Tech Community Ecosystem · ArcGIS Group Symbol Layer

A prototype reusable layer that displays individually interactive items around shared geographic anchors. The demo maps Spanish tech communities with adaptive territorial compositions, an accessible directory, and a bilingual Calcite interface. Built with ArcGIS Maps SDK for JavaScript **5.1**, TypeScript, Vite, and Calcite.

[Live demo](https://www.rauljimenez.info/arcgis-group-symbol-layer/) · [Source repository](https://github.com/hhkaos/arcgis-group-symbol-layer)

## AI use transparency and inspiration

This project's code was created with artificial intelligence using **OpenAI Codex**, guided by the project author's requirements and feedback.

The visualization is inspired by **People For the People (2020)** by Patrick Arlt: [source project](https://github.com/patrickarlt/pftp-who-is-running-2020), [presentation recording starting at 19:44](https://www.youtube.com/watch?v=0AlQItdHBy4&t=1184s).

## Run locally

Requires Node.js 22.12 or later supported by Vite 8. Development has used Node 22.23.3.

```sh
npm ci
cp .env.example .env
# Set VITE_ARCGIS_API_KEY if no .env already exists.
npm run dev
```

**Keep an existing `.env`**; do not overwrite it with the example. Use an ArcGIS Location Platform browser API key with only the required basemap privilege and referrer restrictions for localhost and the final GitHub Pages URL. `.env` is ignored. Never commit credentials. Browser keys are visible in compiled applications; privileges and referrer restrictions provide access control.

Without a key, local territory data and community symbols still load, with a notice explaining the missing light gray basemap. Visitors do not sign in, and community data does not need ArcGIS hosting.

## Explore the application

- English is the default. The header language selector switches to Spanish and remembers the choice locally when browser storage is available. Application labels, messages, accessible names, and SDK controls follow the selected language. Original community names, descriptions, and geographic names remain in their source language.
- The Calcite Shell has a collapsible directory sidebar. A compact search input has an accessible name, a leading search icon, and a trailing filter button integrated through the input action slot. Live search and Enter apply the query; the decorative search icon does not introduce a duplicate action. Filters start collapsed and hidden; the filter action reveals type, status, autonomous community, dependent province, and visible-area scope choices. **Show results** collapses it to make room for the directory. The filter block summarizes the current choices when opened. The directory count is a chip in its Flow Item header, avoiding a duplicate summary row.
- **Active** is selected initially. Choose **All statuses** to include the full snapshot. Selecting an autonomous community reveals its province selector; changing the community clears the previous province. These filters affect matching map items and directory results. Province navigation fits the supplied community locations, not an authoritative province extent.
- Hover a logo or dot for a nearby name tooltip. Click a symbol or directory row to open a second-level Calcite Flow panel in the sidebar. Further map selections replace its content without a close action. A collapsed sidebar opens automatically. Back returns to the retained directory; Escape also returns from details. The map stays interactive.
- `+` scopes the directory to all matching members of its group. **All results** removes that temporary scope. Numeric badges also zoom closer. There is no technical group-inspection dropdown.
- **Only the visible area** is enabled initially. It includes members of groups whose compositions intersect the map viewport, including members hidden under `+` or a badge. This is a group-visibility scope, not an individual coordinate-in-extent test. Turn it off to include all matching records, including those without map representation.
- Directory rows use stable source identities and retain image nodes, focus, and pagination where possible. Camera updates wait until navigation settles, then debounce for 160 ms. Pages contain 12 results in Spanish-locale alphabetical order for consistent geographic names.
- **Map options** lives in the header. Its panel contains grouping, boundaries, representation, wheel navigation, visibility, opacity, layer reattachment, and synthetic datasets. The map footer shows the grouping level and current group/community counts instead of preparation timings.

At smaller widths, the sidebar and map-options panel overlay the map; opening one closes the other. The directory starts collapsed on mobile. There is one shared directory/detail model across sizes, rather than separate mobile content copies.

## Share a view and use Back / Forward

Copy the address bar URL to share the current filters, language, and map footprint. The URL is updated locally with the History API; it works on GitHub Pages without server routes or reloads.

- Search is one history step per continuous edit: the first change adds an entry and later characters replace it after a short pause or explicit apply, even across longer pauses in the same edit. Enter, leaving the field, or applying filters ends the edit.
- Filter choices and language changes create checkpoints. Automatic navigation after region/province changes is captured after it finishes. Map navigation is coalesced after it settles; window/sidebar resizing updates the current entry instead of adding steps.
- Back and Forward restore filters, locale, grouping, and the camera inside the app. Restoration cancels pending writes and does not push another entry. The initial state replaces the current entry.
- The link's language overrides a saved browser preference. Region/province IDs are checked against the loaded data; invalid choices are cleared. Invalid camera values are ignored while valid filters remain usable.

| URL parameter | Meaning |
| --- | --- |
| `lang` | `en` or `es` |
| `q`, `type`, `status` | Search (up to 500 characters), category, and `active` / `inactive` / `unknown` / `all`. Missing status defaults to active. |
| `region`, `province` | Administrative IDs; province requires its parent region. |
| `group`, `visible` | Temporary overflow-group scope and `0` for global directory scope; visible-area scope is the default. |
| `dataset`, `grouping`, `level`, `variant` | Non-default dataset/grouping/representation; resolved automatic level preserves grouping hysteresis. |
| `view` | Longitude, latitude, map scale, rotation, viewport width, and viewport height, separated by commas. |

The stored viewport dimensions allow the same rotated geographic footprint to fit a different screen. A narrower or differently shaped viewport can show additional area to retain the entire shared footprint. Fitting waits for the header/footer layout and SDK viewport to settle. It always derives scale from the original shared camera to avoid accumulating fitting errors. URLs preserve the repository path, unrelated query parameters, and hash. Application state serialization does not read the API key.

## Adaptive symbols

Each group chooses its representation from its matching item count, available screen footprint, territory shape, and neighboring compositions, in this order:

1. All logos.
2. The largest fitting logo subset plus `+`.
3. All colored dots.
4. A numeric badge when dots do not fit or exceed the density cap.

Logos and dots are not mixed within a group. The default cap is **24 visible items** and a partial image summary needs at least **three logos**. Groups of one or two can still show all logos; their fallback remains individual dots even when strict boundary fitting fails. At the same zoom, different groups can show different representations and different numbers of logos.

Zoom changes available space but does not enforce a uniform summary. Automatic geographic regrouping is separate: it switches from autonomous communities to municipalities at **7.2**, and back at **6.8**, with hysteresis. Original reference examples retain their zoom **4.5** overflow profile. The community adapter supplies explicit spatial budgets; the layer's default zoom profile is preserved for other consumers.

Fitting uses the **parent autonomous community** by default, including for municipality groups. This allows logos to cross small municipal borders when screen space exists. Anchors remain interior points of their own administrative group. Boundaries are hidden initially, names are opt-in, and boundary clicks do nothing. Badges have bounded collision separation with leader lines to their anchors.

## Developer preferences

Edit [demo.config.ts](demo.config.ts) before startup:

```ts
export default {
  boundaries: { mode: "none", labels: false, clickAction: "none" },
  activation: { emphasizeOnItemClick: false, emphasizeOnGroupAction: false },
  basemap: { referenceLayersVisible: false },
  directory: { mapExtentOnly: true },
  presentation: {
    territoryConstraint: "region",
    maxVisibleItems: 24,
    minVisibleImages: 3,
  },
  navigation: {
    inputMode: "auto",
    smoothWheelZoom: true,
    sensitivity: 0.0025,
    durationMs: 180,
    preserveTrackpad: true,
  },
};
```

Partial runtime updates preserve other preferences:

```js
window.groupDemo.configure({ boundaries: { mode: "regions", clickAction: "inspect" } });
window.groupDemo.configure({ presentation: { maxVisibleItems: 16, minVisibleImages: 4 } });
window.groupDemo.setGrouping("locality"); // "region" | "locality" | "auto"
```

`window.groupDemo.options` returns a copy of current preferences. UI controls change that same configuration.

| Preference | Meaning |
| --- | --- |
| `boundaries.mode` | `none`, `auto`, `regions`, `provinces`, or `municipalities`. Automatic province visibility starts at zoom 6.5; municipalities at 8.5, subject to their 1:2,000,000 minimum scale. |
| `boundaries.clickAction` | `none`, `inspect` (name only), or `select` (emphasize and attenuate). Boundary visibility does not enable selection. |
| `activation.emphasizeOnItemClick` / `emphasizeOnGroupAction` | Optional territory emphasis on item/group activation; both disabled initially. |
| `basemap.referenceLayersVisible` | Initially false so basemap reference labels do not draw over custom symbols. Independent of the synthetic reference dataset. |
| `directory.mapExtentOnly` | Directory scope checked against rotated screen-space composition bounds; does not remove source memberships. |
| `presentation.territoryConstraint` | `region`: parent autonomous community; `group`: own polygon, including municipality; `none`: inter-group spacing only. Independent of whether outlines are drawn. |
| `presentation.maxVisibleItems` | Individual-marker density cap, integer 2–100; default 24. |
| `presentation.minVisibleImages` | Minimum partial image summary, integer 2–`maxVisibleItems`; default 3. Does not prevent full one/two-logo groups. |

These are consuming-application preferences. `GroupSymbolLayer` requires no administrative boundaries and does not open panels, navigate, or select territories itself. It emits activations; the application decides their behavior.

## Optional smooth mouse wheel

The application-level controller is enabled initially; it is not a built-in SDK property. Use **Map options** to compare native and smoothed navigation or force an input type.

| Option | Default | Meaning |
| --- | --- | --- |
| `smoothWheelZoom` | `true` | Enable controller. |
| `sensitivity` | `0.0025` | Zoom levels per normalized pixel; range 0.0001–0.02. A 100-pixel impulse targets 0.25 levels. |
| `durationMs` | `180` | Interpolation duration after the last impulse; range 40–600 ms. |
| `inputMode` | `auto` | `auto`, `mouse`, or `trackpad`. Explicit modes bypass device heuristics. |
| `preserveTrackpad` | `true` | In automatic mode, preserve native SDK handling for gestures classified as trackpad. False smooths all wheel input. |

Classification latches for each gesture and resets after 250 ms idle. Fractional deltas are not automatically trackpad input: some mouse drivers generate them. The controller normalizes pixel/line/page units, clamps extreme impulses, accumulates a target zoom, and updates viewpoint with `requestAnimationFrame`. Cursor anchoring respects rotation and zoom limits. Drag, keyboard input, resize, or another application navigation cancels interpolation. Ctrl-wheel/pinch and reduced-motion users keep native handling. It does not start `goTo()` for every wheel event. Geographic grouping transitions remain discrete.

Capture device input explicitly from the browser console:

```js
window.groupDemo.wheelNavigation.startDiagnostics("mouse");
// Use only this device for about five seconds, including slow and fast input.
copy(JSON.stringify(window.groupDemo.wheelNavigation.stopDiagnostics(), null, 2));
```

Repeat with `"trackpad"` and identical navigation settings. `copy()` is a Chrome/Edge console helper; otherwise log the JSON and copy it manually. Captures contain original deltas, units, timings, SDK decisions, target zoom, frames, cancellation reasons, and browser metadata. They do not contain keys, URLs, or community records. Capture is bounded, local, and opt-in; no per-frame console logging during navigation. Hardware classification remains heuristic. See the [SDK proposal](docs/js-sdk-smooth-wheel-zoom-proposal.md) for physical mouse/trackpad findings and the tester's confirmation.

## Reuse the layer

The layer is independent of this interface, Spanish data, and election examples.

```ts
import { GroupSymbolLayer } from "./src/layer/index";
import type { SymbolGroup } from "./src/layer/index";

const groups: SymbolGroup[] = [{
  id: "area:1", label: "Activity area", territoryId: "country:region:1",
  anchor: { x: -3.7, y: 40.4, wkid: 4326 }, variant: "images",
  items: [{
    id: "chapter:1", sourceId: "organization:1", label: "Example community",
    category: "technology", image: "https://example.org/logo.png",
    imageFit: "contain", description: "Plain-text information.",
  }],
}];
const layer = new GroupSymbolLayer({ groups, appearance: { colors: { technology: "#167c72" } } });
map.add(layer);
const subscription = layer.onActivate(event => {
  if (event.type === "item") console.log(event.groupId, event.itemId);
  else console.log(event.groupId, event.counts);
});
layer.setFilter(item => item.category === "technology");
layer.selectTerritory("country:region:1");
layer.configure({ imageSize: 36, gap: 6, detailZoom: 7 });
layer.setData(groups); // Replace data without recreating the map.
layer.opacity = 0.7;
layer.visible = false;
layer.setFilter();
layer.selectTerritory();
map.remove(layer);
map.add(layer);
subscription.remove();
```

`npm run build:lib` generates `dist-lib/group-symbol-layer.js` and TypeScript declarations, with the SDK external. Import its ES module and `dist-lib/index.d.ts`, or include `src/layer/` in another SDK 5.1 project.

### Data, identity, and interaction

- Groups require `id`, `label`, `anchor`, `variant`, and `items`; items require `id`, `label`, and `category`. Images, fitting, descriptions, URLs, and source IDs are optional.
- Layer identity is `(group.id, item.id)`; `sourceId` survives application-defined geographic regrouping. The source is never mutated.
- Supported 2D coordinates: WGS84 / EPSG:4326 and Web Mercator / EPSG:3857. WGS84 latitude is limited to ±85.05112878°. Unsupported systems, invalid coordinates/budgets, and duplicate identities throw.
- Input order determines painter priority. Last group/item wins overlap. Groups do not merge by proximity. Hit zones match visible circles; gaps do not activate items. Provide an accessible directory for small/dense symbols.
- `getResults(zoom)` separates `total`, `matching`, `displayed`, and `hidden`. `+` and numeric badges are not displayed items.
- Optional positive integer `visibleItems` overrides zoom-based overflow for one group. It adds `+` only when matching items exceed that budget.
- `presentation: "count"` emits `overflow` with zero displayed items and all matches hidden. Below `countThreshold`, individual dots remain instead.
- `declutterCounts` uses bounded per-view placement and leader lines. It changes neither source anchors nor memberships and cannot guarantee arbitrary collision resolution.
- `imageFit: "cover"` fills portrait circles; `contain` preserves complete logos. Missing, failed, or CORS-blocked images show initials. Use CORS-enabled HTTP(S) image URLs; navigation URLs also accept only HTTP(S). Text is inserted as text.
- Use one layer instance per map for independent selection/filtering. Instances can share source data. Each view owns its assets and handlers.

### Appearance options

| Option | Layer default | Range / meaning |
| --- | --- | --- |
| `imageSize` | 32 | 16–72 CSS pixels |
| `dotSize` | 12 | 6–36 CSS pixels |
| `overviewScale` | 0.9 | 0.5–1; overview size/gap multiplier |
| `gap` | 5 | 0–24 CSS pixels |
| `maxColumns` | 6 | Integer 1–20 |
| `detailZoom` | 4.5 | 0–24 |
| `summaryThreshold` | 7 | Integer 2–10000 |
| `summaryVisible` | 5 | Positive integer below `summaryThreshold` |
| `summarizeDots` | false | Allow dot summaries in the legacy zoom profile |
| `attenuation` | 0.22 | 0–1; combined with layer opacity |
| `defaultColor` | `#64748b` | Unknown category color |
| `overflowColor` | `#173d46` | `+` background |
| `colors` | `{}` | Per-category colors |
| `countSize` | 24 | 16–48 CSS pixels |
| `countThreshold` | 3 | Integer 2–10000; minimum matches for a badge |
| `declutterCounts` | false | Bounded badge separation with leader lines |
| `showLabels` | false | Group caption |

Symbols use overview and detail sizes: 90% and 100% by default. Within each profile, sizes/gaps are constant CSS pixels. Explicit per-group budgets replace overflow choices, not the size multiplier.

## Data and refresh

The snapshot contains **657 records**: 545 with coordinates and 112 without geometry. Two more request no map display; all **114** unmapped records remain available when viewport scope is off. Of 104 distinct coordinates, 103 resolve to a municipality using the supplied IGN/Living Atlas services. There are **88 local groups**, including an unresolved fallback.

```sh
npm run data:prepare       # Reproducible offline conversion.
npm run data:refresh-admin # Public administrative queries.
npm run data:prepare       # Incorporate refreshed memberships.
```

Refresh downloads simplified region polygons, province attributes, and memberships/geometries for represented municipalities, not every municipality in Spain. It requires no API key. Preparation computes approximate interior anchors while preserving original community coordinates. To refresh the directory, replace `public/data/communities.source.json`, refresh administrative memberships, regenerate, and update snapshot dates/attribution.

See [data sources and terms](public/data/ATTRIBUTION.md). Community Builders data is CC BY 4.0; Living Atlas administrative items have separate terms including use within ArcGIS. Real logos load from their original hosts and are not redistributed. Synthetic examples use local SVG images. External data, proper names, identifiers, and source descriptions are preserved rather than translated.

## Validate and deploy

```sh
npm test
npm run build
npm run build:lib
npm run preview
```

`dist/` uses relative paths suitable for a GitHub Pages repository. The [workflow](.github/workflows/pages.yml) tests/builds before deployment. Select **Pages → Source → GitHub Actions** and add **VITE_ARCGIS_API_KEY** as a repository **Actions variable** with the final referrer restriction (`https://www.rauljimenez.info/*`). This browser-visible key is compiled into the client bundle; it is not treated as a secret. Local `.env` is never uploaded. The project inherits the personal site’s custom domain, so no project-level `CNAME` is needed. The deployment URL is `https://www.rauljimenez.info/arcgis-group-symbol-layer/`.

See [architecture](docs/architecture.md), [validation](docs/validation.md), [interface redesign plan](docs/ui-redesign-plan.md), and [SPEC](SPEC.md).

## Prototype limits

Target browsers are current Chrome, Edge, Firefox, and Safari on desktop/mobile; verified environments are listed in the report. This is not physical-device or accessibility certification.

No 3D, arbitrary packing/collision guarantees, printing, screenshot API, automatic ArcGIS legend, WebMap persistence, or editing. Footprint fitting samples simplified polygons and cell contours rather than computing exact geometric containment. Badge separation can exhaust its bounded search. Only the nearest world copy is drawn. Remote images may change or fail. Administrative membership describes supplied coordinates, not a verified community headquarters or activity area. Optional provincial/municipal inspection depends on public Living Atlas services.

The deterministic 470-group / 1,283-item workload supports measurement; it is not a maximum capacity or a production performance guarantee.
