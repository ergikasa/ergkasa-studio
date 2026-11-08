import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The asset library is served as-is: /manifest.json, /characters/char_drini_01/asset.svg, ...
// The Studio reads exactly the files the render worker reads; nothing is copied or converted.
const assetsDir = fileURLToPath(new URL("../assets", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: assetsDir,
  server: { port: 5173, strictPort: true, host: "127.0.0.1" },
});
