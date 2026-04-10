import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // IMPORTANT: In Desktop (Electron) production builds we load the UI via file://.
  // Vite's default base ('/') makes assets resolve to file:///assets/... which breaks.
  // Using a relative base fixes blank-window issues in packaged builds.
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1"
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("jszip")) return "jszip";
            if (id.includes("react")) return "react-vendor";
            return "vendor";
          }
          if (id.includes("/src/panels/FamilyBudget") || id.includes("/src/panels/Trading") || id.includes("/src/panels/Grow")) return "ops-panels";
          if (id.includes("/src/panels/News") || id.includes("/src/panels/FamilyHealth") || id.includes("/src/panels/GroceryMeals")) return "life-panels";
          if (id.includes("/src/panels/Brain") || id.includes("/src/components/HomieBuddy") || id.includes("/src/components/CommandBar") || id.includes("/src/lib/brain") || id.includes("/src/lib/commandCenter") || id.includes("/src/lib/plugins") || id.includes("/src/lib/voice")) return "brain-core";
          return undefined;
        },
      },
    },
  },
});
