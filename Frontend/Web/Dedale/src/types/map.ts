// Type pour les géométries de la DB
export interface GeometryData {
  id: string;
  event_id: string;
  geom: string;
  name?: string;
}
export interface Zone {
  id: string;
  name: string;
  event_id: string;
  color: string;
  description?: string;
  geometry_json: string;
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
  name?: string;
  event_id: string | null;
  status?: boolean;
  comment?: string;
  type?: string;
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

// Types pour les équipements
export interface EquipementType {
  id: string;
  name: string;
  description?: string;
}

export interface EquipementCoordinate {
  id: string;
  equipement_id: string;
  x: number;
  y: number;
  order_index?: number;
}

export interface Equipement {
  id: string;
  type_id?: string;
  type_name?: string;
  type_description?: string;
  length?: number;
  description?: string;
  date_pose?: string;
  hour_pose?: string;
  date_depose?: string;
  hour_depose?: string;
  coordinates: EquipementCoordinate[];
}
