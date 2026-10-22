import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initEmoji } from "./lib/emoji";
import "./index.css";
// Aplica el tema guardado antes del primer render.
import "./theme/useTheme";

// Los emoji (Twemoji empaquetado) necesitan sus datos antes de dibujar la primera pantalla.
void initEmoji().then(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
