// Type pour les géométries de la DB
export interface GeometryData {
  id: number;
  event_id: number;
  geom: string;
}
export interface Zone {
  id: string;
  name: string;
  event_id: string,
  color: string,
  geometry_json: string,
}

export interface Parcours {
  id: string;
  event_id: string;
  name: string;
  color: string;
  start_time: string;
  speed_low: number;
  speed_high: number;
  geometry_json: string;
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
  id: string;
  x: number;
  y: number;
  event_id: string | null;
  status?: boolean;
  comment?: string;
  pictures?: Array<{
    id: string;
    point_id: string;
    image?: string;
  }>;
}

export interface MapInterest {
  id: string;
  x: number;
  y: number;
  description: string;
  event_id: string | null;
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
