import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: "dist-lib",
    lib: { entry: "src/layer/index.ts", formats: ["es"], fileName: "group-symbol-layer" },
    rolldownOptions: { external: /^@arcgis\// },
  },
});
