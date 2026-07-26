import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist-renderer",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        overlay: resolve(__dirname, "overlay.html"),
        control: resolve(__dirname, "control.html"),
        splash: resolve(__dirname, "splash.html"),
      },
    },
  },
  server: {
    strictPort: true,
    port: 5173,
  },
});
