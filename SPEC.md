# Grouped Symbol Layer — Product Specification

## Purpose

Create a reusable map layer that displays several individually identifiable items around a shared geographic anchor. Each group forms a compact arrangement of circular dots or image markers, including portraits and logos. Users can explore individual items, filter the collection, focus on a territory, and understand when a group contains more items than are currently shown.

The initial target is a 2D web map using ArcGIS Maps SDK for JavaScript 5.1. The deliverable is a new, independent project containing reusable functionality and a working demonstration. This specification defines the desired behavior; the implementation approach remains open.

The layer must be usable beyond elections. Candidates, parties, states, and congressional districts are examples of items, categories, and territories, rather than concepts built into the reusable layer.

## Example use cases

These are illustrative applications of the same behavior, rather than separate products to build. Each application supplies the meaning of membership, categories, and actions.

| Use case | Group and anchor | Individual items | Example exploration |
| --- | --- | --- | --- |
| Candidates by electoral territory | State or district, with a representative geographic anchor | Candidates shown as portraits or category-colored dots | Filter by party or other attributes, inspect a candidate, and focus a territory. |
| Companies operating in a market | City, region, or service area | Company logos, categorized by industry or service | Filter by sector, see which companies operate in a region, and open a company profile. |
| Developer or professional communities | City or regional community hub | Logos of local communities or chapters | Filter by topic or language, inspect a chapter, and find its website or events. |
| Community organizations and public services | Neighborhood or administrative area | Organization logos or service icons | Filter by service type, discover organizations serving the area, and open contact or eligibility information. |
| Events and their participants | Event venue or host city | Sponsor, exhibitor, or participating organization logos | Filter by role or sector, inspect a participant, and open its event profile. |
| Teams or projects by operational area | Site, campus, or assigned territory | Team portraits, project images, or identifying icons | Filter by specialty or project status and inspect the people or projects associated with an area. |

For example, a region with eight matching companies could display five logos and a “+” in the overview presentation. Selecting a logo opens that company's information; selecting “+” requests the region's full matching company list. A community map can use the same interactions with chapter logos and topic categories. These applications may choose different size, summary, and activation settings from the election demonstration.

The geographic meaning must be clear to users. A company shown in a regional group may serve that region without having an office at the anchor. Likewise, a community's marker may identify its area of activity rather than a meeting venue. If exact premises or venue locations are needed, the consuming application must provide that information separately.

The same organization may belong to several groups when the application defines multiple regional memberships. Filtering and counts apply to each group's supplied memberships; a count of memberships across groups must not be presented as a count of unique organizations unless the application establishes that distinction.

## Intended experience

A user opens a map and sees groups at their geographic locations. Some groups contain colored dots; others contain portraits, logos, or icons with category-colored borders. Each composition stays centered on its anchor as the user navigates the map.

At an overview level, large image groups display a limited number of items and a “+” indicator. At a closer level, all matching items become visible. Users can inspect or activate an individual item, or activate the indicator to request an action for the whole group.

Filtering changes the items represented on the map. Selecting a territory emphasizes its groups while retaining surrounding context. Clearing filters and selection restores the original collection and appearance.

## Required information

Each group has:

- A stable identity and a human-readable label.
- A geographic anchor with an explicit coordinate reference system.
- A display variant: dots or images (portraits, logos, or icons).
- An ordered collection of items.
- Optional descriptive information and a territory identity for selection.

Each item has a stable identity within its group, a label, a category, an optional image, and optional descriptive information. Group and item identities together must identify an item unambiguously.

Groups are provided by the consuming application. Nearby groups remain separate even when their symbols overlap. Item membership is determined by the supplied data, rather than geographic proximity. Individual items share their group's anchor; their positions within the composition do not represent separate geographic locations.

## Required behavior

### Group appearance and layout

- Support circular dots colored by category and circular image markers with category-colored borders.
- Support both photographs and logos. Allow portraits to fill their circular frame, while allowing logos and icons to remain fully visible with padding and a suitable background. Wide or tall logos must not lose essential content through forced portrait-style cropping.
- Allow both variants in the same layer. The reusable layer does not change a supplied group's variant merely because zoom changes. In the community demonstration's explicitly adaptive profile, the consuming application may supply images, dots, or a count presentation based on available territorial space, preserving source item identities.
- Arrange items in compact rows around the anchor. Center incomplete rows and the overall composition.
- Preserve the supplied item order, including when choosing which items remain visible in a summarized group.
- Allow the consuming application to configure category colors, item sizes, spacing, layout limits, and the overflow appearance.
- Keep sizes and spacing visually consistent at a given level of detail, including on displays with different pixel densities.
- Keep rows and images upright relative to the screen when the map rotates.
- Adapt sizes and spacing to the level of detail within documented, bounded ranges. Exact legacy size formulas and column counts are not required.
- Use a recognizable fallback when an image is missing or fails to load. Give unknown categories a valid default appearance.

General collision avoidance between arbitrary item compositions is outside the initial scope. Following prototype feedback, the community demonstration checks candidate images and dots against their administrative polygon and previously accepted compositions. It falls back to a count when space is insufficient. Optional per-view decluttering separates count badges with leader lines to their geographic anchors. These count callouts may lie outside the polygon; they are summaries associated with a territory, not item locations. Overlapping groups in explicit image/dot modes and reference examples retain predictable display and interaction priority, and all items remain discoverable through the accessible directory.

### Level of detail and overflow

The layer must support configurable overview and detailed presentations. Summarization changes what is displayed, without changing group membership or item identity. The same overflow behavior must be available for portraits, logos, and icons.

The demonstration must include this reference behavior:

| Portrait group after filtering | Overview presentation | Detailed presentation |
| --- | --- | --- |
| No items | No symbols or overflow indicator | No symbols or overflow indicator |
| One to six items | All items | All items |
| Seven or more items | First five items and one “+” indicator | All items, without “+” |

For the reference demonstration, use overview presentation below zoom 4.5 and detailed presentation at zoom 4.5 or above. This is a configurable demonstration profile, not a geographic rule for all consuming maps. Dot groups do not summarize in this profile.

Keep the following counts distinct: total items in the supplied group, items matching the active filter, displayed items, and matching items hidden by summarization. The indicator is not counted as an item. For example, a group with ten supplied items, eight matches, and five displayed portraits has three hidden matches.

The “+” must be distinguishable from an individual item. Its information must clearly describe the group and the relevant counts. Activating it requests a group action; it does not inherently mean expanding the group. The demonstration should focus the associated territory or group and make its matching items available for inspection.

### Item information and activation

- Let users inspect an item's label, category, image when available, and relevant descriptive information.
- Make this information available with pointer, keyboard, and touch interactions; essential information must not require hover.
- Activating an item identifies that specific item and its group to the consuming application.
- Activating overflow identifies the group and its counts, without pretending to select an individual item.
- Let the consuming application decide whether activation opens details, navigates, or performs another action.
- Use the displayed item's location for interaction. Sharing an anchor must not cause every item in a group to be selected together.
- Gaps between items must not activate unrelated items. Define and document any enlarged touch targets and how competing targets are resolved.
- Resolve an item or overflow action before an underlying territory action, so one activation does not produce conflicting navigation.
- Preserve normal map navigation, including gestures initiated over the visualization, while distinguishing navigation from activation.

The information presentation may use a tooltip, popup, panel, or another accessible interaction. No particular presentation mechanism is prescribed.

### Filtering and territorial selection

Filtering and selection have different effects:

- Filtering determines which items are represented. Recalculate layout and overflow from matching items and omit empty groups.
- Selection emphasizes the selected territory's groups and attenuates other groups without removing them.
- Allow filtering and selection to operate together.
- Restore all original items when filters are cleared. Neither operation may mutate the supplied collection.
- Use complete territory identities. Districts with the same number in different states must remain distinguishable.
- Keep item identities stable through layout changes, filtering, selection, and zoom changes.

The consuming application supplies filtering criteria and territory relationships. The layer must not hard-code political categories or demographic rules.

### Map integration and updates

- Let the consuming application add, hide, show, remove, and reuse the layer.
- Respect layer opacity and its position relative to other map layers. Whole-layer opacity and selection attenuation must combine predictably.
- Keep symbols correctly anchored during pan, continuous zoom, rotation, and viewport resizing.
- Accept updates to data, appearance, filters, and selection without requiring the consuming application to recreate the map.
- Ensure data or image results that arrive late cannot restore obsolete content after an update or removal.
- Removing the layer must remove its visual and interactive presence. Repeated removal and reattachment must not duplicate actions or leave stale content.
- Keep the same data usable in multiple maps without sharing screen positions or selection unintentionally.
- Interpret input coordinates according to their declared reference system. Clearly document supported systems and report unsupported or invalid input rather than silently misplacing groups.

### Accessibility and resilience

- Provide an accessible way to discover matching groups and items, inspect details, and perform the same item and group actions as a pointer user.
- Avoid requiring users to tab through every map symbol to reach other controls.
- Give controls meaningful names and visible focus. Do not communicate category or selection solely through color.
- Make hidden matching items discoverable without requiring precise map gestures.
- Keep the map usable when images fail or the collection is empty.
- Present supplied labels and descriptions safely as content.

## Demonstration and deliverables

Provide reusable functionality, a standalone demonstration, and documentation covering expected inputs, configuration, interactions, supported environments, and known limitations.

The demonstration must use portable sample data and images that can be distributed with the project. It must not require the historical election services or original application to run. It should show both variants, filtering, territory selection, overflow, individual activation, visibility, and opacity controls, together with an accessible way to inspect results.

Include a small nonpolitical example using fictional company or community logos, including wide and tall images. It must exercise the same filtering, overflow, and activation behavior without election-specific labels or rules. The other use cases above do not require separate demonstrations.

Include groups with 0, 1, 3, 6, 7, and 24 items, plus missing images, unknown categories, and overlapping groups. Include a representative collection of approximately 470 groups and 1,283 items. These numbers are a validation workload, not a maximum supported capacity or a performance guarantee.

Document observed responsiveness for navigation, filtering, and updates on identified browsers and devices. Performance targets should be agreed before claiming production readiness.

## Acceptance scenarios

| ID | Expected outcome |
| --- | --- |
| A-01 | A new consuming application can display dot and portrait groups from its own data at the intended anchors. |
| A-02 | Groups of the specified sizes have centered compositions, with no empty cells or indicators left behind after updates. |
| A-03 | Seven portraits produce five portraits plus “+” below the reference threshold, and seven portraits at or above it. Six portraits remain fully displayed at both levels. |
| A-04 | Applying and clearing filters restores exactly the original item identities and produces correct total, matching, displayed, and hidden counts. |
| A-05 | Activating a visible item returns only the intended identity; overflow produces a distinct group action. Gaps, overlap, and touch targets behave as documented. |
| A-06 | Selecting one district does not emphasize a district with the same number in another state. Clearing selection restores normal emphasis. |
| A-07 | Pan, zoom, rotation, resizing, and different display pixel densities preserve anchoring, upright appearance, and accurate interaction. |
| A-08 | Visibility, opacity, and layer order behave consistently with other map content. Reattachment and repeated updates produce no duplicate actions. |
| A-09 | Slow or failed images, replacement data, and removal during loading produce no stale or misplaced content. |
| A-10 | Keyboard and touch users can discover details and activate items and overflow, including matching items hidden in the overview presentation. |
| A-11 | The representative workload remains usable, with performance observations and any practical limits documented. |
| A-12 | Two maps using the same source data maintain independent navigation, layout, and selection. |
| A-13 | Company or community logo groups support the same filtering, overflow, and individual actions as portrait groups. Wide and tall logos remain recognizable without unwanted cropping, and the example contains no election-specific assumptions. |

## Confirmed prototype decisions

- Project root: this folder (`arcgis-group-symbol-layer`). Delivery tooling: TypeScript and Vite.
- Public web demonstration, without visitor sign-in, deployed to GitHub Pages.
- ArcGIS Location Platform provides the light gray basemap. Use a browser API key with minimum basemap privileges and referrer restrictions; never commit credentials.
- Bundle a GeoJSON snapshot derived from https://directory.communitybuilders.dev/data/communities.json and administrative inputs from the user-provided public IGN/Living Atlas services (`CCAA_wgs1984_wm`, `Prov`, and `muni`). Preserve source attribution, item terms, and identifiers. Keep records without valid coordinates available for non-map inspection without inventing locations. Use complete municipal codes for local grouping, with explicit fallback for unresolved coordinates.
- Application-defined grouping switches between autonomous communities in an overview and localities when zoomed in. Allow the consuming application to fix a level programmatically. This changes the supplied group memberships at the application level; the reusable layer never infers proximity or administrative membership. Preserve a source item identity across these application-level regroupings.
- Community presentation is adaptive per supplied group: try all logos, the largest fitting logo subset plus `+`, all colored dots, then a matching-item counter. Decide from the actual screen footprint, territory shape, matching-item count, and neighboring groups, independently of a global zoom summary threshold. Do not mix logos and dots within a group. Developer preferences `maxVisibleItems` (default 24) cap individual-marker density, and `minVisibleImages` (default 3) set the minimum useful partial logo summary. Use a counter when all dots cannot fit or exceed the density cap; one or two matching items retain individual dots by default. The adapter supplies an explicit per-group `visibleItems` budget; without it the reusable layer retains its original zoom overflow profile. Re-evaluate after filtering and after navigation settles. Choose interior administrative label points as group anchors. Keep original source coordinates in the GeoJSON. Counts retain distinct total/matching/displayed/hidden semantics, and count activation focuses the territory's results and zooms closer. The reference `+` profile remains available unchanged.
- Strengthen administrative outlines and provide automatic or explicit boundary levels for communities, provinces, and municipalities, with consultable names and selected-territory emphasis. On-map administrative labels are optional to avoid obscuring symbols; hover, activation, and the accessible directory expose names.
- Hovering an item shows its community name in a tooltip near the displayed symbol; clicking retains the details dialog. Essential information remains accessible by keyboard and touch through activation and the directory. Hide basemap reference layers so their labels do not overpaint the grouped symbols.
- Developer preferences are applied before layer creation through `demo.config.ts`. Administrative boundaries default to hidden, and boundary clicks default to no action. Visibility, labels, and boundary click behavior (`none`, name inspection, or selection/emphasis) are independent settings. Item/group activation emphasis and basemap reference visibility are also configurable. Geographic membership and fitting calculations remain available with hidden boundaries. The reusable symbol layer emits activations; consuming applications own contextual layers and interaction policy.
- Trial application-level wheel smoothing is enabled and developer-configurable, with an on-screen native/smoothed comparison switch. Accumulate coarse wheel input, interpolate fractional zoom while preserving the cursor's map point, respect zoom limits and reduced motion, and retain native handling for fine pixel input and Ctrl-wheel/pinch. Device classification is heuristic and must be checked on physical hardware. This does not change the reusable symbol layer or its geographic grouping thresholds.
- Following physical input captures, wheel classification is latched per gesture rather than changed for each event. Fractional mouse input can be smoothed; accelerating trackpad gestures remain native. Expose `auto`, `mouse`, and `trackpad` input modes so developers and testers can bypass device heuristics explicitly.
- The directory defaults to the viewport's matching groups, with a developer option and accessible switch to inspect the entire filtered collection, including unmapped records. Scope uses prepared group compositions intersecting the screen viewport, not each membership's original coordinate. Update after navigation settles with a short trailing delay. Reuse rows and loaded images by stable identity, preserve valid pagination and keyboard focus, and avoid rebuilding unchanged list content during wheel/trackpad navigation. Geographic regrouping must not reset directory pagination by itself.
- Adaptive fitting defaults to the associated autonomous community's polygon even for municipal groups: small municipal boundaries must not unnecessarily suppress logos when the arrangement fits within its parent region and does not overlap neighboring compositions. Developers may choose strict group-polygon containment or screen-space-only spacing through `presentation.territoryConstraint`. Group membership and anchor points remain unchanged.
- Keep zoom-dependent geographic grouping separate from within-group overflow. The original zoom 4.5 overflow profile remains available in a dedicated reference demonstration; tune the community demonstration's grouping and overflow thresholds independently.
- Target current Chrome, Edge, Firefox, and Safari on desktop and mobile. Document actual tested environments separately from intended support.
- Measure navigation, filtering, and updates against the representative workload before setting performance guarantees. This delivery makes no production readiness claim.

## Scope boundaries

The first delivery is a functional prototype of reusable behavior, not a migration of the original election application. It does not require 3D, live election data, data editing, address search, geolocation, application routing, or automatic collision avoidance.

Map capture, printing, automatic legend integration, and saving/loading through standard WebMaps are optional extensions. They must not be advertised as supported without their own agreed behavior and validation.

Access to the bundled sample data and authentication to ArcGIS basemap resources are separate. Visual defaults and geographic grouping thresholds will be refined during prototype validation. Implementation choices should be evaluated against this specification and current SDK capabilities.

## Historical context

The inspiration is the People For The People candidate map presented by Patrick Arlt. Its useful product behavior is grouped, individually interactive items tied to territories, with filtering, focus, and an overview summary.

The existing [historical analysis and SDK review](docs/requisitos-capa-simbolos-agrupados-sdk-5.1.md) and [presentation transcript](docs/tactiq-free-transcript-0AlQItdHBy4.txt) are optional background in the source repository. This specification is intended to stand on its own when copied into a new project. The older code and the implementation strategies discussed in that analysis are not prescribed designs. Reassess the solution using current SDK documentation rather than reproducing the historical implementation or its defects.
