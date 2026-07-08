import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@cleaning-duties/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
      "@cleaning-duties/shared/": fileURLToPath(new URL("../../packages/shared/src/", import.meta.url)),
    },
  },
});
