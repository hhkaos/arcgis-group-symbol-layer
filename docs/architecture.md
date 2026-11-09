# Architecture and decisions

The requirements were gathered using `gather-arcgis-application-requirements`; implementation follows `build-with-arcgis-maps-sdk-for-javascript`, `follow-arcgis-authentication-patterns`, and `build-with-calcite-design-system`.

## Reusable layer

`GroupSymbolLayer` is an ArcGIS `Layer`; each 2D view gets a `BaseLayerView2D` canvas renderer. Using the SDK render lifecycle, rather than a DOM overlay, preserves layer ordering and map navigation. The SDK composites whole-layer opacity. The renderer applies only selection attenuation. Each layer view owns its projected points, image cache, and event handles.

The layout model is independent of ArcGIS. It computes counts and centered rows from ordered matching memberships. Symbol sizes are CSS pixels. Anchors are projected once when data changes, then transformed with `RenderParameters.state.toScreen()` at render time. Pixel ratio is applied to the backing canvas and removed from anchor screen coordinates before applying CSS pixel offsets. Hit testing uses `MapView.toScreen()`. Rows remain screen aligned at every rotation.

Each view caches one offscreen canvas per group composition and pixel ratio. Navigation draws cached group images rather than recreating every circle and logo. Revisions, LOD changes, image completion, and pixel ratio changes invalidate compositions. Selection attenuation and layer opacity are applied when compositing. The nearest wrapped world instance is drawn; repeating a group across multiple world copies in a very wide viewport is not currently supported.

Hit testing uses circles matching the displayed symbols, no enlarged invisible target area. Gaps return no result. Last supplied group, then last displayed cell, wins overlap, matching painter order. Touch users can use the directory's larger buttons for dense groups. The layer's `immediate-click` consumes a hit before the demo's territory action. It does not intercept pointer-down, drag, wheel, or pinch events.

Per-view handlers are removed on detach. Image handlers check the current cache entry and active lifecycle; removed data drops obsolete images. No screen positions or selection are written to caller-owned data. Separate layer instances can share the same supplied data and maintain independent state.

## Data adapter and geographic grouping

The application supplies geographic membership. The refresh script queries the user-provided public IGN/Living Atlas municipality service for each distinct supplied coordinate, checks item public access, and saves matches. A separate offline conversion script builds GeoJSON and joins province/region attributes using the returned codes. There is no geocoding, nearest-polygon guessing, or runtime geographic proximity clustering.

Locality groups use **complete municipal NATCODE identifiers** and the source municipal name. Multiple supplied coordinates in the same municipality share a group. The adapter's default source anchor can be used independently; the demonstration replaces it with an approximate interior label point computed from the administrative polygon's main component. This avoids coastal or border-adjacent source anchors forcing arrangements outside their territory. Original source coordinates remain in each GeoJSON feature. Regional and municipal assignments describe the supplied point's administrative location, not an independently verified activity area.

The automatic adapter switches to locality at zoom 7.2 and back to region at 6.8. This hysteresis avoids oscillation around zoom 7. The group IDs include the level; source item IDs survive regrouping. `window.groupDemo.setGrouping("region" | "locality" | "auto")` overrides the demo profile. Geographic regrouping and within-group overflow are independent:

- Community example: a per-group spatial budget, independent of the global zoom overflow threshold.
- Reference and stress examples: original overflow threshold 4.5; dots never summarize unless explicitly configured.

The adaptive community profile tests full image compositions, then progressively smaller image summaries with `+`, then all dots, then a count. Each candidate must fit the simplified territorial polygon and previously accepted composition bounds. The search maximizes visible logos with a bounded number of candidates. `presentation.maxVisibleItems` defaults to 24 (density cap, valid range 2–100); `minVisibleImages` defaults to 3 (minimum useful partial logo summary). Full groups of one or two can still show logos; their fallback is individual dots, never a numeric badge under the default count threshold. Dots are not partially summarized by this strategy: if their number exceeds the density cap or their full footprint cannot fit, a counter is used. Logos and dots are not mixed within a group.

The adapter supplies an explicit positive `visibleItems` budget with each item presentation, overriding the reusable layer's legacy zoom summary. It never removes hidden memberships: `total`, `matching`, `displayed`, and `hidden` retain their distinct meanings, and `+` uses the full matching list. Without an explicit budget, the original reference behavior is unchanged. This keeps a single spatial strategy, rather than maintaining alternative automatic modes or adding callbacks for individual territories. Tests exercise four different presentations at the same zoom and repeat above/below the old detail threshold.

Recalculation happens after filters and when navigation settles, not in the render loop. Variant, presentation, or item-budget changes invalidate the layer snapshot; identical decisions do not. On dense views, count-only badges can move within a bounded radial search, with leader lines to geographic anchors. Render and hit testing share this placement procedure. Item compositions remain at their anchors. When search space is exhausted, normal painter priority still applies.

The default fitting constraint is the parent autonomous community, including for municipal groups. Strict containment in a small municipality had unnecessarily suppressed Pamplona's single logo, Zaragoza's six active logos, and MorcillaConf in Burgos at zoom 8 despite ample screen space. `presentation.territoryConstraint` can instead request the group's own polygon (`group`) or only inter-group spacing (`none`). Anchor geometry still comes from the group itself; this preference changes fitting, not membership or anchoring. A regression uses the bundled real administrative geometry and active records for those three cases.

`+` focuses the group's territory and its complete matching directory list without an implicit zoom/expansion. Numeric count activation also zooms closer. Selecting a group from the accessible directory emphasizes its territory. Filtering affects membership; selection only attenuates other territories on the map. The directory may narrow to the selected territory while the map retains surrounding context.

Static regional polygons are available as optional context. Public FeatureLayers from the user-provided province and municipality services allow detailed boundary inspection, with optional automatic zoom-dependent visibility. Labels are opt-in to avoid covering symbols; pointer hover and configured activation expose territory names through a readout, and all groups remain named in the keyboard-accessible directory. Explicitly selected regional polygons use a distinct outline and fill.

Developer preferences in `demo.config.ts` are resolved before creating the map layers. Boundaries are hidden by default; their click action is independently `none`, `inspect`, or `select`. Enabling their visibility does not enable emphasis. Item/group emphasis and basemap reference visibility are also independent preferences. `groupDemo.configure()` merges partial updates and synchronizes controls. Automatic geographic regrouping preserves existing explicit symbol selection; it does not infer selection from the directory's current territory filter. Changing example datasets explicitly clears selection.

Basemap reference layers are hidden after style initialization because ArcGIS draws them above operational content. A single controlled Calcite tooltip is anchored to the displayed item's hit-test point; there is no DOM node per marker. Pointer movement uses a short trailing debounce, and stale hit tests are ignored after navigation or data/layer changes. Clicking retains the modal details dialog, while the directory provides equivalent keyboard/touch access.

## Optional wheel navigation

`SmoothWheelZoom` belongs to the demo, not the reusable layer. It intercepts coarse public `mouse-wheel` events, normalizes the native delta units, accumulates a clamped target zoom, and interpolates using `requestAnimationFrame`. A single atomic `viewpoint` update sets scale and an adjusted center, preserving the cursor anchor with rotation. It uses no private SDK navigation APIs and does not call `goTo()` for each wheel event.

Automatic input classification latches a device hypothesis for the gesture, resetting after 250 ms idle. It considers units, horizontal movement and the first nonzero vertical delta, including fractional mouse input. A gesture initially classified as trackpad remains native when it accelerates. This is a heuristic, not reliable hardware identification. Explicit `mouse` and `trackpad` modes bypass it. Ctrl-wheel and reduced motion always remain native. Pointer-down, keyboard input, resize, disabling the controller, or another navigation from the demo cancel the interpolation. Completion triggers the adaptive presentation update; tooltips stay closed during interpolation. Controller event handles, media-query listener, and animation frames are cleaned up on page disposal.

The snapshot contains 657 records: 545 have coordinates, and 543 also request map display. All 114 records without map representation remain available in the directory. Of 104 distinct coordinates, 103 resolve to one municipality; the unresolved point keeps its own fallback group. This produces 88 local groups including that fallback. No record is silently moved to a guessed territory. The 470-group/1,283-item collection is a separate deterministic synthetic validation dataset.

## Directory updates and viewport scope

The directory uses keyed row reconciliation rather than rebuilding its subtree. Community source IDs are stable keys across geographic regrouping; synthetic memberships use group/item identity. Each retained button points to its latest result model, so changing a group or its counts does not leave stale activation callbacks. Loaded image nodes remain attached when their URLs and labels are unchanged. Rows are sorted by Spanish locale name for predictable order across group levels.

Camera changes schedule a trailing 160 ms refresh. Work waits until native navigation and the custom wheel interpolator have settled. Crossing a geographic grouping threshold updates map data without immediately resetting the directory or its pagination. Unchanged select options, legend entries, and status strings are not rewritten. Adaptive map compositions also avoid replacing layer data when their variant, presentation, and visible-item budget have not changed.

`directory.mapExtentOnly` defaults to true and has an accessible on-screen switch. It includes matching members of groups whose prepared cell bounds intersect the viewport, using projected screen coordinates so rotation is respected. It is a group-visibility scope, not a point-in-extent test for every organization's original coordinate. The map retains all source data. Disabling the scope restores the full filtered directory, including records without map representation. New scope/filter choices restart pagination; navigation preserves the current page unless it exceeds the new page count.

## Access and distribution

GitHub Pages serves public static data, images, and the application. ArcGIS Location Platform supplies the authenticated light gray basemap. A least-privilege browser API key is configured locally through `.env` and during deployment through a GitHub Actions secret. Browser keys are visible to visitors; referrer restrictions and privileges are the controls, not environment-variable secrecy. No backend or user identity is required for this prototype.

If no key is configured, the map still shows local Spanish territory polygons and the layer, with a visible notice. It does not silently switch to another hosted basemap. The live basemap is not required for the layer's synthetic examples.

## Verification references

- [MapView: projection and stationary state](https://developers.arcgis.com/javascript/latest/references/core/views/MapView/)
- [BaseLayerView2D](https://developers.arcgis.com/javascript/latest/references/core/views/2d/layers/BaseLayerView2D/)
- [Vite setup](https://developers.arcgis.com/javascript/latest/vite/)
- [GeoJSONLayer](https://developers.arcgis.com/javascript/latest/references/core/layers/GeoJSONLayer/)
- [API key authentication](https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/)
- [Calcite](https://developers.arcgis.com/calcite-design-system/)

Implementation was checked against installed SDK 5.1 declarations and source, including `RenderParameters.pixelRatio` and engine-level layer opacity composition. SDK type declarations omit the documented view/layer constructor members, so the layer-view constructor widens that input explicitly. The generic `Layer.createLayerView()` boundary uses a narrow cast after runtime 2D/projection validation.

For the spatial-budget change, the Esri documentation MCP was unavailable; the official MapView reference above was consulted directly as fallback. The per-group candidate priority and density budget are application design decisions, not built-in SDK behavior.
