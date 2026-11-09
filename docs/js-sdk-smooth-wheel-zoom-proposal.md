# Feature request: configurable smooth wheel zoom in MapView

**Audience:** ArcGIS Maps SDK for JavaScript engineering team  
**SDK evaluated:** 5.1.27  
**Date:** November 9, 2026  
**Status:** Application-level workaround implemented; the tester confirmed that the interaction issue was resolved.

## Request

Please consider an opt-in, view-level setting for smooth mouse-wheel zoom, alongside the existing navigation configuration. The need is to interpolate sparse wheel input into a continuous camera movement while retaining responsive high-resolution trackpad navigation.

We already had `view.constraints.snapToZoom = false`. Fractional zoom levels were available, but mouse-wheel navigation still felt noticeably stepwise compared with the laptop trackpad. A quick trackpad gesture felt smooth and responsive; the mouse felt like a sequence of separate increments.

This is an enhancement request based on that experience, rather than a claim of a confirmed SDK regression. In particular, the device-classification failures described below belonged to our first workaround, not to the SDK.

## Environment and reproducibility

| Item | Confirmed information | Still needed |
| --- | --- | --- |
| SDK | `@arcgis/core` 5.1.27; 5.1-series map components | Comparison with other SDK releases |
| View | 2D MapView through `arcgis-map`; Web Mercator | Independent minimal MapView-only reproduction |
| Zoom constraints | `snapToZoom: false`, `minZoom: 2`, `maxZoom: 17` | Other constraint profiles |
| Browser | Google Chrome **157.0.8103.39**, Official Build, **x86_64**, confirmed by the tester; the captures' user agent reports `157.0.0.0` | Other browsers |
| Operating system | **macOS Tahoe 26.7.2 (25G332)**, confirmed by the tester | — |
| Computer | **Apple MacBook Pro, 16-inch, 2019** | — |
| Processor | **2.4 GHz Intel Core i9, 8 cores** | — |
| Memory | **32 GB, 2667 MHz DDR4** | — |
| Graphics | **AMD Radeon Pro 5300M, 4 GB** | — |
| Trackpad | MacBook Pro's built-in trackpad, tested separately from the mouse | — |
| Mouse | **Logitech M110 Wired USB Mouse**, USB connection | Additional driver configuration, if applicable |
| Scroll configuration | Browser-delivered values were recorded | OS scrolling settings and any scroll-remapping/smoothing utility |

The reported user agent was:

```text
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36
```

The `Mac OS X 10_15_7` token is **not sufficient to establish the actual macOS version**. The macOS version/build, physical hardware, and full Chrome version above were supplied directly by the tester; they were not inferred from the user agent. Whether any third-party scroll utility is installed remains unconfirmed. Device assignment in the captures follows the tester's identification, not a browser hardware identifier.

The application includes a custom grouped-symbol layer. We have not established whether the same perceived difference occurs in a bare MapView with no application overlays. A minimal native-only reproduction and a wider device/browser matrix would strengthen an SDK investigation. The supplied data and custom visualization are not intended to be prerequisites for the proposed navigation feature.

## Why disabling zoom snapping did not meet this need

[`snapToZoom`](https://developers.arcgis.com/javascript/latest/references/core/views/2d/MapViewConstraints/#snapToZoom) controls snapping to LODs. Allowing fractional scales and controlling the temporal response to wheel input are separate concerns.

The public [Navigation](https://developers.arcgis.com/javascript/latest/references/core/views/navigation/Navigation/) and [NavigationActionMap](https://developers.arcgis.com/javascript/latest/references/core/views/navigation/NavigationActionMap/) APIs reviewed for this investigation did not expose a dedicated wheel-smoothing duration or policy. `momentumEnabled` is documented in terms of continued **panning** after pointer release, so we did not treat it as a wheel-zoom smoothing control.

The request is for an explicit way to tune this interaction, not an assertion that the SDK performs no animation internally.

## What we measured

We added an explicit, bounded diagnostic capture at two points: the native DOM `wheel` event and our public SDK `mouse-wheel` listener. It recorded native deltas and units, event intervals, SDK deltas, the workaround's routing decision, interpolated zoom frames, and cancellation reasons. It did not record credentials, request URLs, or map data.

The two physical-input captures contained:

| Observation | Mouse | Trackpad |
| --- | --- | --- |
| Events captured | 23 | 225 |
| Native `deltaMode` | 0, pixels | 0, pixels |
| Absolute native `deltaY` range | Approximately 4.000244–471.477661 | 1–133 |
| Median interval between events | 73.8 ms | 16.7 ms |
| Events with nonzero `deltaX` | 0 | 62 |
| Numeric character of vertical deltas in these samples | Fractional | Integer |

Intervals include pauses between gestures; these are descriptive values from two captures, not device specifications or general classification rules. The input pipeline includes the browser, OS, driver, and potentially other software; the captures do not establish which component produced the acceleration or fractional values.

Representative mouse deltas included:

```text
-4.000244140625
-7.1575927734375
-29.2083740234375
-151.5081787109375
-471.4776611328125
```

A trackpad gesture could start with small deltas such as `-1`, `-2`, and `-4`, then accelerate to much larger integer deltas during the same gesture.

### What failed in our first workaround

Our initial heuristic treated small or fractional pixel deltas as trackpad-like and only smoothed sufficiently large integer deltas, or line/page input. The captures showed why that assumption was unsuitable:

- All **23 mouse events** were routed to native handling, resulting in **zero custom animation frames**. This explained why enabling our smoothing option made no perceptible difference for the tester's mouse.
- **32 of the 225 trackpad events** were incorrectly routed to the smoother when the trackpad accelerated; 193 remained native. Thus, one physical gesture could alternate between two navigation implementations.
- The mixed trackpad path recorded 22 `view-interacting` cancellations and only one custom animation frame. Our controller was yielding while native interaction was already active. This is evidence of a coordination problem in our workaround, not proof of an SDK navigation defect.

The practical lesson is that fractional versus integer deltas, or the magnitude of one event, do not reliably identify a mouse or trackpad. High-resolution mice and trackpads can produce overlapping input patterns.

## Application-level solution

The implementation is independent of the symbol layer. It uses public view APIs and does not patch SDK modules or call private navigation methods.

### Input policy

We added three developer-selectable modes:

- **Auto:** classify a gesture and retain its vertical-input classification as it accelerates.
- **Mouse:** explicitly apply the custom smoother, avoiding device heuristics.
- **Trackpad:** explicitly retain native handling.

In auto mode, the current heuristic considers delta units, horizontal movement, and the first nonzero vertical input. Line/page units indicate wheel-like input; horizontal pixel movement indicates trackpad-like input. A vertical-only gesture initially uses its magnitude and fractional characteristics. The classifier resets after **250 ms** without events. Horizontal movement can update the classification; vertical acceleration alone does not switch a trackpad gesture to mouse handling.

This heuristic successfully replays the two supplied traces, but it is **not a universal device detector**. The explicit modes provide deterministic behavior when auto detection is inappropriate. A native SDK implementation could use a different input policy or avoid device classification entirely.

### Normalization and interpolation

For input handled by the smoother:

1. Convert native wheel units to a common amount. Our prototype uses 16 pixels per line and the view height for page units; these are application choices, not guarantees about physical wheel movement.
2. Clamp each normalized impulse to ±240 pixels to bound extreme inputs.
3. Accumulate a target zoom instead of starting an independent animation for every event. Clamp the destination to the view's effective zoom limits.
4. Interpolate toward that target with `requestAnimationFrame`, using cubic ease-out. A new impulse retargets from the current zoom toward the accumulated destination.
5. Update scale and center atomically through `view.viewpoint`, keeping the map point beneath the cursor stationary.

Current application defaults are:

```ts
navigation: {
  inputMode: "auto",
  smoothWheelZoom: true,
  sensitivity: 0.0025, // Zoom levels per normalized pixel.
  durationMs: 180,    // Interpolation duration from the latest impulse.
  preserveTrackpad: true,
}
```

These are **our application's options**, not existing SDK properties. The numbers are prototype tuning values, not proposed SDK defaults.

### Cursor anchoring

For a Web Mercator view, each frame uses:

```text
ratio = 2 ^ (currentZoom - nextZoom)
nextScale = currentScale * ratio
nextCenter = anchor + (currentCenter - anchor) * ratio
```

`anchor` is the result of `view.toMap()` at the wheel event's screen position. We retain the view rotation and set the new center and scale in one `Viewpoint`. This preserves the cursor's geographic anchor through fractional zoom and rotation. This implementation has not been generalized or validated for arbitrary spatial references or SceneView.

### Navigation coordination and accessibility

The controller prevents the native wheel action only for events it handles. Trackpad/native events remain available to the SDK. Ctrl-wheel events, commonly associated with trackpad pinch, and reduced-motion preference retain native handling. Pointer-down, keyboard input, resize, configuration changes, or another navigation initiated by the demo cancel the custom interpolation. Animation frames and listeners are removed on disposal.

We deliberately avoided an independent `goTo()` call for each wheel event, which would require coordinating repeatedly interrupted animations. The application also waits until smoothing completes before recalculating its adaptive symbol presentation.

This application-side ownership of gesture detection, cancellation, cursor anchoring, and presentation timing is a significant part of the motivation for a native option.

## Outcome and validation limits

After the gesture-classification correction and explicit device modes were added, the tester confirmed that the problem was resolved.

Supporting checks include:

- Replay of the recorded input tuples: all **23 mouse events** classify as mouse and all **225 trackpad events** classify as trackpad, without switching during vertical acceleration.
- Browser simulation of a fractional mouse impulse, `-4.000244140625`, produced 12 custom animation frames.
- A simulated trackpad gesture starting at `-1` and accelerating to `-133` stayed entirely native.
- Explicit mouse mode smoothed a small `-2` pixel event in 12 frames.
- An earlier simulated `-100` pixel impulse moved from zoom 5.5 to approximately 5.75 over multiple frames, with about **0.117 screen pixels** of cursor-anchor displacement at 23° rotation in that check.
- The project test suite passes **24 tests in total**, including input normalization, cursor-anchor mathematics, gesture classification, and replay regressions. Not all 24 tests concern navigation.

The replay fixture contains only timing and delta tuples, not the complete capture metadata. Correctly replaying those traces does not establish accuracy on other devices. The frame counts and anchor error above are individual simulated checks, not a performance guarantee. We have not completed cross-browser, cross-platform, or broad hardware validation, and did not collect a second physical trace after the final correction.

## Suggested SDK capability

An opt-in setting on `MapView.navigation` would let applications request this behavior without replacing wheel navigation themselves. It should remain independent of whether zoom snaps to LODs.

For illustration only, **this is not a current SDK API**:

```ts
view.constraints.snapToZoom = false; // Existing API.

// Hypothetical API for discussion; naming and shape are intentionally provisional.
view.navigation.wheelZoom = {
  mode: "smooth", // Versus the existing/default interaction.
  duration: 180,   // Milliseconds, if an advanced tuning option is warranted.
};
```

The key requirement is the capability, rather than this particular API design or our implementation. A single boolean with suitable defaults might be sufficient; advanced sensitivity/input-policy options could be added if the SDK team considers them useful.

Useful evaluation criteria would be:

- Smooth interpolation of sparse/coarse wheel input with low input latency.
- Preservation of responsive high-resolution input and rapid trackpad gestures.
- Consistent cursor anchoring, including rotation and effective scale constraints.
- Retargeting during consecutive impulses, without queuing independent animations.
- Predictable interaction with pinch, drag, keyboard navigation, programmatic navigation, and reduced motion.
- Backward-compatible opt-in behavior and clear cancellation/lifecycle semantics.
- Testing across OS acceleration settings, mouse drivers, high-resolution wheels, and browser delta-unit differences.

The SDK owns the input normalization and navigation lifecycle, so it may be able to provide a more robust and efficient solution than an application-level controller. We would welcome a different approach that achieves the same interaction quality, including one that does not attempt hardware classification.

## Implementation and reproduction materials

Repository-relative files:

- [Wheel controller](../src/demo/SmoothWheelZoom.ts)
- [Input classification and anchor mathematics](../src/demo/wheelMath.ts)
- [Bounded local diagnostic capture](../src/demo/WheelDiagnostics.ts)
- [Regression tests](../src/demo/wheelMath.test.ts)
- [Recorded timing/delta fixtures](../src/demo/fixtures/wheel-input.json)
- [Developer configuration](../demo.config.ts)

To compare in this application, run `npm ci` and `npm run dev`, then use **Opciones → Suavizar rueda del ratón** and **Dispositivo de zoom**. Capture one device at a time without changing other navigation settings. The map's data and API credentials are not included in the diagnostic report.

The existing public interaction entry point is documented under [MapView events and navigation](https://developers.arcgis.com/javascript/latest/references/core/views/MapView/). The request is to make the smoother behavior available through the SDK's own view navigation system, using these observations as one concrete case for evaluation.
