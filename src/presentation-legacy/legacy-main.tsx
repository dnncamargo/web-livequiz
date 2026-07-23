import { createRoot } from "react-dom/client";
import { LegacyPresentation } from "./LegacyPresentation";
import "./legacy.css";

const rootElement = document.getElementById("legacy-root");

if (!rootElement) {
  throw new Error("Elemento #legacy-root não encontrado.");
}

createRoot(rootElement).render(<LegacyPresentation />);
