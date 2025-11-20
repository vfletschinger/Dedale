import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/login.tsx"),
    route("/accueil", "routes/accueil.tsx"),
    route("/carte", "routes/carte.tsx"),
    route("/equipes", "routes/equipes.tsx"),
    route("/planning", "routes/planning.tsx"),
] satisfies RouteConfig;