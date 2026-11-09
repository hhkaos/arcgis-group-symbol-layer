# Prototype validation

Date: **November 9, 2026**. These are observed checks, not production certification or a capacity guarantee. Historical observations below describe the earlier interface where explicitly stated; the current Calcite interface has a separate validation section.

## Environment

- Node.js 22.23.3, installed SDK 5.1.27; exact dependencies in `package-lock.json`.
- Earlier automated Chrome 157.0.0.0 reported `MacIntel`, eight logical processors, and 32 GB. Physical hardware was not independently verified.
- Earlier desktop views: 1514 × 787 and 1440 × 900, DPR 1. Mobile emulation: 390 × 844, DPR 2, touch and reduced motion; not a physical phone.
- Development and production-preview servers have been exercised locally. The user-configured key loaded the light gray basemap; credentials are excluded from this report.

## Automated checks

`npm test`: **50 tests across seven files**. The original 32 regression tests cover:

- Cases 0, 1, 3, 6, 7, and 24; exact zoom 4.5 threshold, counts, ordering, filtering, restoration, and source immutability.
- Centered rows, noninteractive gaps, painter priority, item/overflow identity, invalid coordinates/configuration/IDs, and unsafe URLs.
- Exact 470-group / 1,283-item workload, geographic grouping hysteresis, stable source IDs, 112 records without geometry, and interior anchors.
- Individual dots for one/two matches even when a counter is requested. Four equal 12-item groups choose 12 logos, eight logos plus `+`, 12 dots, or a counter at the same zoom; repeated at zoom 3 and 12 with constant size.
- Explicit per-group budgets independent of zoom, hidden counts and overflow activation, filtered groups without unnecessary overflow, density preferences, neighbors, and stable repeated decisions.
- Territorial holes and adaptive recalculation. Real-geometry regression at zoom 8: Pamplona's single logo, Zaragoza's six active logos, and MorcillaConf in Burgos use parent regional fitting rather than strict municipality containment.
- Wheel normalization, direction, extreme impulses, cursor anchoring with fractional zoom/rotation, and device classification. Regression fixtures classify all 23 mouse and 225 trackpad events consistently through gesture acceleration; the fixture contains timings/deltas only.

Bilingual interface tests additionally check Spanish coverage for declared static UI/accessibility strings and count interpolation in both languages without translating proper source names.

URL/history tests also cover full-state and Unicode round-trips, explicit all-status, automatic-level hysteresis, URL locale priority, malformed/non-finite/out-of-range cameras, bounded text, orphan province omission, screen-footprint fitting, debounced navigation, state deduplication, Back/Forward cancellation, one-entry search edits through long pauses, debounced rapid replacements with an immediate first checkpoint, deferred camera capture, listener cleanup, and size-only replacement.

`npm run build` checks TypeScript and generates the app. `npm run build:lib` produces the independent ES module and declarations with the SDK external.

## Current Calcite interface

The redesign uses a Shell, collapsible Shell Panels, Flow/Flow Items for nested details, an expandable filter Block, and Calcite controls. English is the default; Spanish is available from the header. Community source descriptions and names remain unchanged.

Verified in the running application on desktop and with 390 × 844 DPR 2 touch/reduced-motion emulation:

| Current workflow | Observed result |
| --- | --- |
| Clean browser context | English title, identity, controls, and application locale by default. |
| Persistent locale | Spanish selection survived reload; document title, Calcite built-in labels, SDK controls, and app labels used Spanish. |
| Region/province hierarchy | Andalucía exposed its eight provinces. Sevilla returned exactly 28 active source records in both map matching items and global directory. |
| Locale stability | Switching to Spanish retained the selected region/province and the first result button/image nodes; filter summary became “Andalucía · Sevilla · Activas”. |
| Details | Directory selection opened one Flow detail item; subsequent public layer activation replaced the selected community without closing it. No dialog elements remained. |
| Collapsed sidebar | Item activation reopened it and showed details. Back restored the directory. |
| Keyboard | Real Enter key opened details and focused its back action; Escape selected the directory and returned focus to the originating row, on desktop and mobile emulation. |
| Filters | Initially hidden/collapsed. The inline filter action opens/closes the Block; Show results collapses it. Visible-area scope is inside it. Search remains available with a placeholder, accessible name, leading search icon, and trailing slotted filter button. |
| Map options | Header action opened the settings panel; Escape closed it and returned focus to that action. |
| Mobile shell | Sidebar initially collapsed in overlay mode. Opening it preserved a map area; no horizontal overflow (390 px document width). Opening map options collapsed the directory. |
| Compact directory | Count chip in the Flow Item header; no duplicate summary row. Filter toggle synchronized hidden/expanded/highlighted/accessible states and English/Spanish labels. Searching “Morcilla” live or with Enter returned MorcillaConf with count one. The final input has a decorative leading icon and a single slotted filter button, without tooltips. |
| Current content | Promotional headings, technical group dropdown, hidden-match explanation, home button, and preparation timing removed. Grouping/count status present in footer; credits/AI disclosure/recording retained. |

During keyboard validation, focusing a newly selected Flow item before its render could leave focus on the document body. Deferring focus to the next animation frame corrected Enter/Escape behavior. Historical modal/mobile stacking observations below do not describe the current design.

## Share-link and history checks

- Region Andalucía / province Sevilla produced 28 active matches. Typing `A`, `Ag`, then `Agile` with pauses produced one search history entry and one matching community.
- Browser Back restored the previous search and camera; Forward recovered the later state. The history length did not increase while restoring. Rapid Back/Forward preserved the latest URL, filters, locale, and rotation.
- A copied link opened in another browser context with an English storage preference. The URL restored Spanish, the Agile query, active status, Andalucía/Sevilla, global directory scope, and rotation 37°.
- At 390 × 844 DPR 2 mobile emulation, the shared desktop footprint (599 × 654, scale 449989.0919) fitted at scale 691137.0924, matching the width ratio, with its center and 37° rotation retained. No console errors were reported in that check.
- After alternating the empty and Agile searches, browser Back and Forward restored the respective viewport heights (628 and 654 pixels) with zero measured scale drift; history length stayed constant.
- Header/footer layout changes are allowed to settle before camera fitting. A bounded refit recalculates from the original shared camera when the final adaptive legend changes map height; size-only URL updates replace the checkpoint.

## Earlier browser observations

| Behavior | Observed result |
| --- | --- |
| Basemap | `arcgis/light-gray` vector layer loaded; normal startup had no console errors. Reference layers hidden to keep their labels off symbols. |
| Initial preferences | Region/province/municipality outlines hidden, no initial selection, partial preference updates preserve other settings. |
| Boundary clicks | Real Castilla-La Mancha click: `none` did nothing; `inspect` showed name without selection; `select` selected `34080000000`. |
| Service metadata | All three supplied administrative layers were public. Municipal data exposed `NAMEUNIT`. |
| Geographic grouping | Municipality grouping appeared on zoom-in with the same source IDs. |
| Spatial presentations | Fixed regional grouping at zoom 6: Andalucía five logos plus `+` / 105 matches, Castilla y León seven plus `+` / nine, Murcia seven dots, Valencia badge 22. At zoom 8: Andalucía 24 plus `+`, Castilla y León all nine, Valencia 15 plus `+`. |
| Budget updates | Setting `maxVisibleItems` to four changed Andalucía/Castilla y León to four logos; restoring 24 recovered five/seven without reload. |
| Adaptive overflow hit | Valencia at zoom 8 returned `overflow`, 22 matching, 15 displayed, seven hidden. Local grouping retained Pamplona (one), Zaragoza (six), Burgos (one) logos. |
| Badge separation | All 18 badges in one tested overview were separated; this is not a general guarantee. |
| Hit testing | 60 mixed-profile positions and 12 rotated municipal positions matched the top drawn item. |
| Reference / rotation | 52 positions at 47° matched item identity and painter priority. At DPR 2 all 52 interior hit positions also had visible canvas pixels. |
| Detach / reattach | Three cycles retained one layer, two handlers in the new view, and an inactive old view. |
| Opacity | Screenshots at 0, 0.5, and 1 had roughly 0.29 RGB-level mean error against expected blending, without opaque screenshot drift. |
| Two maps | Separate instances sharing source data kept independent filters/selection: seven matches in one and 55 unfiltered in the other. |
| Previous detail interface | Enter opened the previous modal and focused close; Escape returned focus. Tooltip and real logo click opened the correct item. The current Flow design replaces the modal. |
| Previous mobile layout | At 390 px, no horizontal overflow; directory below map. The current design uses an overlay sidebar instead. |
| Directory stability | Identical three-impulse wheel sequence with global scope: before four rebuild batches, 48 rows removed/added; after zero top-level child mutations, first button/image retained. |
| Reading context | Regional/local regrouping retained row, image, focus, page 2/38, and sidebar scroll 220 px. |
| Viewport scope | Madrid zoom 9.2 showed 91 matches; Atlantic showed zero plus help text; disabling scope restored all 446 active communities. |
| Smooth wheel | Simulated −100-pixel impulse: zoom 5.5 → 5.74996, 13 observed values, 12 controller frames; cursor-anchor drift 0.117 pixels at rotation 23°. |
| Repeated impulses | Three simulated −100 impulses reached 6.24999 from 5.5. Fine two-pixel input and disabled smoothing passed to native handling. |

Missing-image reference cases intentionally return 404 and show initials. Remote logos can fail through availability or CORS. Programmatic center/zoom/rotation and controls have been exercised; comprehensive physical drag, pinch, and assistive-technology testing remains outstanding.

## Earlier performance observations

Workload: **470 groups / 1,283 items**, local synthetic images, desktop DPR 1. A small production-build sample after image warmup, before later territorial/interface changes:

| Operation | Observation |
| --- | --- |
| Dataset switch, controls/list preparation, synchronous portion | 64.3 ms |
| Search/list update, synchronous portion | 10.1 ms |
| Data replacement/layout, five iterations | 0.9–1.3 ms |
| Layer render callback, median / p95 | 1.4 / 1.8 ms |
| Frame intervals during 900 ms navigation, median / p95 | 27.4 / 475.2 ms; eight frames observed |

The last row includes substantial pauses and does not establish smooth navigation. The layer callback excludes map-engine, network, browser, and automation costs. Hardware/load were not controlled; initial download and physical-device capacity were not measured.

Initially all cells were redrawn and anchors projected every frame, with a roughly 21.4 ms median callback. Cached compositions/preprojected anchors reduced that portion to about 1.4–1.6 ms in later samples; total map performance is not guaranteed.

### Directory flicker investigation

Chrome DevTools interaction traces, without reload or CPU/network throttling and with global scope, compared identical results during navigation. A `MutationObserver` on `#results` recorded four rebuild batches and 48 removed/added rows before reconciliation, versus zero afterward. The initial row/image remained connected. CLS was 0.00 in both traces: node/image replacement caused flicker without a measured layout shift. LCP and INP were not measured.

Viewport refresh waits 160 ms and is deferred during native navigation/custom wheel interpolation. Real result changes insert/remove only necessary rows. Twelve rows per page did not justify virtualization or another framework. Territorial fitting runs after navigation, not each frame. Administrative modes need a separate device campaign before setting performance targets.

### Physical wheel input investigation

The first heuristic passed all 23 mouse events to native handling and tried smoothing 32 of 225 trackpad events. The mouse produced fractional deltas from ±4.000244 upward; the trackpad began with small integers and accelerated within the gesture. Gesture-latched classification fixes both regression traces; explicit device modes remain available.

A corrected simulated −4.000244-pixel mouse impulse produced 12 smoothing frames. Trackpad −1 followed by −133 stayed native. Explicit mouse mode smoothed −2 pixels over 12 frames. No console errors appeared. The user subsequently confirmed the physical interaction issue was resolved; detailed hardware, captures, and proposal are in [the SDK report](js-sdk-smooth-wheel-zoom-proposal.md). This is one tester's confirmation, not general hardware coverage.

## Coverage limits

Outstanding: Safari, Firefox, Edge, physical phones/tablets, screen readers, comprehensive touch, slow networks with data replacement, sustained memory measurements, and published GitHub Pages validation. Browser wheel input does not reliably identify physical devices; auto classification remains heuristic.

Printing, WebMap persistence, automatic ArcGIS legend, and 3D remain out of scope. Badge placement may exhaust its bounded search. Fitting uses simplified polygons and sampled cell contours rather than an exact packing guarantee.
