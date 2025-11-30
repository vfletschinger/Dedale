import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"
import '@tailwindplus/elements';
import { initDatabase } from "./services/database";

// Initialiser la base de données au démarrage (déclenche les migrations)
initDatabase()
  .then(() => console.log("[Main] Base de données prête"))
  .catch((err) => console.error("[Main] Erreur d'initialisation DB:", err));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
