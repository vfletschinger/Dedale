// Type pour les géométries de la DB
export interface GeometryData {
  id: string;
  event_id: string;
  geom: string;
  geom_type: "point" | "parcours" | "zone"; // Type de la géométrie
}

// Type pour les obstacles
export interface Obstacle {
  id?: number;
  name?: string;
  number?: number;
  description?: string;
  width?: number;
  length?: number;
}

// Type pour les points de la carte
export interface MapPoint {
  id: number;
  x: number;
  y: number;
  name?: string | null;
  pose?: string | null;
  depose?: string | null;
  obstacles?: Obstacle[];
  comments?: { id: number; value: string }[];
  pictures?: { id: number; image: string }[];
}

// Type pour les événements
export interface MapEvent {
  id: string;
  name?: string;
  event_type?: string;
  status?: string;
  statut?: string;
}

// Type pour les résultats de recherche Nominatim
export interface SearchResult {
  lon: string;
  lat: string;
  display_name: string;
}
