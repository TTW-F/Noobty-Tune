import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/index";

// 自托管字体(离线可用,不依赖 Google Fonts CDN)
import "@fontsource/instrument-serif";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/700.css";

import "./styles/globals.css";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
