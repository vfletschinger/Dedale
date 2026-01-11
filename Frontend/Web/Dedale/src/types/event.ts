export interface Event {
  id: string;
  name?: string;
  date?: Date;
  date_debut?: string;
  date_fin?: string;
  statut: string; // Changed to mandatory
  description?: string;
  geometry?: string;
}

// Type pour les inputs lors de la création/modification d'un événement
export interface EventInput {
  name?: string;
  date_debut?: string;
  date_fin?: string;
  description?: string;
  statut?: string;
  // geometry? : string; // Pas présent dans la version précédente, mais peut-être utile
}

// Type pour les géométries d'événement
export interface GeometryType {
  id: string; // Changed to string
  name: string;
  description?: string;
  color?: string;
}

// Type pour les inputs lors de la création/modification d'une géométrie
export interface EventGeometryInput {
  event_id: string; // Changed to string
  geometry_type_id: string; // Changed to string
  geom: string;
  style_properties?: string;
}

export const DEFAULT_GEOMETRY_TYPES: Event[] = [
  {
    id: "1",
    name: "Zone de couverture",
    date: new Date(),
    geometry: "#4CAF50",
    statut: "actif",
  },
  {
    id: "2",
    name: "Tracé de course",
    date: new Date(),
    geometry: "#2196F3",
    statut: "actif",
  },
  {
    id: "3",
    name: "Zone interdite",
    date: new Date(),
    geometry: "#F44336",
    statut: "actif",
  },
  {
    id: "4",
    name: "Zone de sécurité",
    date: new Date(),
    geometry: "#FF9800",
    statut: "actif",
  },
  {
    id: "5",
    name: "Point de contrôle",
    date: new Date(),
    geometry: "#9C27B0",
    statut: "actif",
  },
  {
    id: "6",
    name: "Zone d'accueil public",
    date: new Date(),
    geometry: "#00BCD4",
    statut: "actif",
  },
  {
    id: "7",
    name: "Ligne de départ/arrivée",
    date: new Date(),
    geometry: "#FFEB3B",
    statut: "actif",
  },
  {
    id: "8",
    name: "Zone logistique",
    date: new Date(),
    geometry: "#795548",
    statut: "actif",
  },
];
