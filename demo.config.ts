import type { DemoOptionsInput } from "./src/demo/config";

/** Developer preferences, applied before layers and handlers are created. */
export default {
  boundaries: {
    mode: "none",
    labels: false,
    clickAction: "none", // "inspect" shows the name; "select" also emphasizes the territory.
  },
  activation: {
    emphasizeOnItemClick: false,
    emphasizeOnGroupAction: false,
  },
  basemap: { referenceLayersVisible: false },
  directory: { mapExtentOnly: true },
  // Keep symbols inside their autonomous community; allow them to cross municipal borders.
  presentation: {
    territoryConstraint: "region", // "group" for strict local bounds; "none" for screen space only.
    maxVisibleItems: 24, // Density cap for individual logos or dots, independent of zoom.
    minVisibleImages: 3, // Prefer dots over a summary with fewer logos.
  },
  navigation: {
    inputMode: "auto",
    smoothWheelZoom: true,
    sensitivity: 0.0025,
    durationMs: 180,
    preserveTrackpad: true,
  },
} satisfies DemoOptionsInput;
