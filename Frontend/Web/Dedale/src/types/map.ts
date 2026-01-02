// Type pour les géométries de la DB
export interface GeometryData {
  id: number;
  event_id: number;
  geom: string;
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
  pose?: string | null;
  depose?: string | null;
  obstacles?: Obstacle[];
  comments?: { id: number; value: string }[];
  pictures?: { id: number; image: string }[];
}

// Type pour les événements
export interface MapEvent {
  id: number;
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
