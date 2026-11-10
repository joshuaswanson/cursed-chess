import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fonts";
import "./styles/global.css";
import App from "./App.tsx";
import { languageReady } from "./i18n";
import { fetchLaterOnes } from "./utils/later";

void languageReady.then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  fetchLaterOnes();
});
