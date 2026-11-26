import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs keep the build usable from any loopback mount point the
  // CLI chooses. Font files are copied rather than inlined so their origins and
  // cache behavior stay inspectable.
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
  server: {
    host: "127.0.0.1",
  },
  preview: {
    host: "127.0.0.1",
  },
});
