const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

// Servir les tuiles depuis le dossier assets/maps
app.use("/maps", express.static(path.join(__dirname, "assets", "maps")));

// Log des requêtes
app.use("/maps", (req, res, next) => {
  console.log(`Tuile demandée: ${req.path}`);
  next();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur de tuiles démarré sur http://0.0.0.0:${PORT}`);
  console.log(
    `Les tuiles sont accessibles via http://localhost:${PORT}/maps/{z}/{x}/{y}.png`
  );
});
