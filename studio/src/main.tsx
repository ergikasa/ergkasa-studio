import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { loadFonts } from "./lib/fonts";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from index.html");

// Text in previews must use the same font files as exported videos; render only once they are ready.
loadFonts()
  .catch((e: unknown) =>
    console.error("Montserrat failed to load; text previews will use a fallback font", e),
  )
  .finally(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
