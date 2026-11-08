import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// The asset library is served as-is: /manifest.json, /characters/char_drini_01/asset.svg, ...
// The Studio reads exactly the files the render worker reads; nothing is copied or converted.
const assetsDir = fileURLToPath(new URL("../assets", import.meta.url));
const samplesDir = fileURLToPath(new URL("../voices/samples", import.meta.url));

/** Serves voices/samples/<id>.mp3 (made by `pnpm voices --samples`) at /voice-samples/<id>.mp3. */
function voiceSamples(): Plugin {
  return {
    name: "erkasa-voice-samples",
    configureServer(server) {
      server.middlewares.use("/voice-samples", (req, res, next) => {
        const name = decodeURIComponent((req.url ?? "").replace(/^\//, "").split("?")[0] ?? "");
        if (!/^[a-z][a-z0-9_]{1,40}\.mp3$/.test(name)) return next();
        const file = join(samplesDir, name);
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("content-type", "audio/mpeg");
        res.setHeader("cache-control", "no-cache");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), voiceSamples()],
  publicDir: assetsDir,
  server: { port: 5173, strictPort: true, host: "127.0.0.1" },
});
