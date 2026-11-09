import { defaultPresentationBudget } from "./presentation";
import type { PresentationBudget } from "./presentation";

export type BoundaryMode = "none" | "auto" | "regions" | "provinces" | "municipalities";
export type BoundaryClickAction = "none" | "inspect" | "select";

export interface DemoOptions {
  boundaries: { mode: BoundaryMode; labels: boolean; clickAction: BoundaryClickAction };
  activation: { emphasizeOnItemClick: boolean; emphasizeOnGroupAction: boolean };
  basemap: { referenceLayersVisible: boolean };
  directory: { mapExtentOnly: boolean };
  presentation: PresentationBudget & { territoryConstraint: "region" | "group" | "none" };
  navigation: { smoothWheelZoom: boolean; sensitivity: number; durationMs: number; preserveTrackpad: boolean; inputMode: "auto" | "mouse" | "trackpad" };
}
export interface DemoOptionsInput {
  boundaries?: Partial<DemoOptions["boundaries"]>;
  activation?: Partial<DemoOptions["activation"]>;
  basemap?: Partial<DemoOptions["basemap"]>;
  directory?: Partial<DemoOptions["directory"]>;
  presentation?: Partial<DemoOptions["presentation"]>;
  navigation?: Partial<DemoOptions["navigation"]>;
}
export const defaultDemoOptions: DemoOptions = {
  boundaries: { mode: "none", labels: false, clickAction: "none" },
  activation: { emphasizeOnItemClick: false, emphasizeOnGroupAction: false },
  basemap: { referenceLayersVisible: false },
  directory: { mapExtentOnly: true },
  presentation: { territoryConstraint: "region", ...defaultPresentationBudget },
  navigation: { smoothWheelZoom: true, sensitivity: 0.0025, durationMs: 180, preserveTrackpad: true, inputMode: "auto" },
};
export function resolveDemoOptions(input: DemoOptionsInput = {}, base = defaultDemoOptions): DemoOptions {
  const options = {
    boundaries: { ...base.boundaries, ...input.boundaries },
    activation: { ...base.activation, ...input.activation },
    basemap: { ...base.basemap, ...input.basemap },
    directory: { ...base.directory, ...input.directory },
    presentation: { ...base.presentation, ...input.presentation },
    navigation: { ...base.navigation, ...input.navigation },
  };
  if (!["none", "auto", "regions", "provinces", "municipalities"].includes(options.boundaries.mode)) throw new Error("Invalid boundaries.mode");
  if (!["none", "inspect", "select"].includes(options.boundaries.clickAction)) throw new Error("Invalid boundaries.clickAction");
  if (!["auto", "mouse", "trackpad"].includes(options.navigation.inputMode)) throw new Error("Invalid navigation.inputMode");
  if (!["region", "group", "none"].includes(options.presentation.territoryConstraint)) throw new Error("Invalid presentation.territoryConstraint");
  if (!Number.isInteger(options.presentation.maxVisibleItems) || options.presentation.maxVisibleItems < 2 || options.presentation.maxVisibleItems > 100) throw new Error("presentation.maxVisibleItems must be an integer between 2 and 100");
  if (!Number.isInteger(options.presentation.minVisibleImages) || options.presentation.minVisibleImages < 2 || options.presentation.minVisibleImages > options.presentation.maxVisibleItems) throw new Error("presentation.minVisibleImages must be an integer between 2 and maxVisibleItems");
  for (const value of [options.boundaries.labels, options.activation.emphasizeOnItemClick, options.activation.emphasizeOnGroupAction, options.basemap.referenceLayersVisible, options.directory.mapExtentOnly, options.navigation.smoothWheelZoom, options.navigation.preserveTrackpad]) if (typeof value !== "boolean") throw new Error("Presentation switches must be boolean");
  if (!Number.isFinite(options.navigation.sensitivity) || options.navigation.sensitivity < 0.0001 || options.navigation.sensitivity > 0.02) throw new Error("navigation.sensitivity must be between 0.0001 and 0.02");
  if (!Number.isFinite(options.navigation.durationMs) || options.navigation.durationMs < 40 || options.navigation.durationMs > 600) throw new Error("navigation.durationMs must be between 40 and 600");
  return options;
}
