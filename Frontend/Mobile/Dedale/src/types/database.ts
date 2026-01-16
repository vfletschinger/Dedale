export type InterestPointsType = {
  id: string; // UUID
  event_id: string; // UUID reference to event
  x: number;
  y: number;
  name?: string | null;
  comment?: string | null; // Integrated comment field
  type?: string | null;
  status?: boolean | null;
  created_at?: string;
  modified_at?: string;
};

export type PictureType = {
  id: string; // UUID
  point_id: string; // UUID reference
  image: string;
};

export type EventType = {
  id: string; // UUID
  name: string;
  description?: string;
  dateDebut?: string;
  dateFin?: string;
  startDate?: string; // Alias pour compatibilité avec le serveur
  endDate?: string; // Alias pour compatibilité avec le serveur
  statut?: string;
};

export type ParcoursType = {
  id: string; // UUID
  eventId?: string; // Alias camelCase pour compatibilité
  event_id?: string; // UUID reference
  name?: string;
  color?: string;
  geometryJson?: string; // Format GeoJSON ou WKT
  wkt?: string; // Alias pour compatibilité
  speedLow?: number;
  speedHigh?: number;
  startTime?: string;
  created_at?: string;
};

export type ZoneType = {
  id: string; // UUID
  eventId?: string; // Alias camelCase pour compatibilité
  event_id?: string; // UUID reference
  name?: string;
  color?: string;
  geometryJson?: string; // Format GeoJSON ou WKT
  wkt?: string; // Alias pour compatibilité
  created_at?: string;
};

// Type pour les événements reçus du serveur avec toutes les données
export type TransferEventType = EventType & {
  parcours?: ParcoursType[];
  zones?: ZoneType[];
  points?: InterestPointsType[];
  teams?: TeamType[];
  actions?: ActionType[];
};

export type EventWithGeometries = EventType & {
  parcours?: Omit<ParcoursType, "id" | "event_id" | "created_at">[];
  zones?: Omit<ZoneType, "id" | "event_id" | "created_at">[];
};

export type EquipementTypeType = {
  id: number;
  name: string;
  description?: string;
  width?: number;
  length?: number;
};

export type EquipementType = {
  id: string; // UUID
  event_id: string; // UUID reference to event
  type_id: string; // UUID reference to type
  quantity: number;
  length_per_unit?: number;
  date_pose?: string;
  date_depose?: string;
  name?: string; // From joined type table
  description?: string;
};

export type EquipementCoordinateType = {
  id: string; // UUID
  equipement_id: string; // UUID reference
  x: number;
  y: number;
  order_index: number;
};

export type TypeType = {
  id: string; // UUID
  name?: string;
  description?: string;
};

export type TeamType = {
  id: string; // UUID
  event_id: string; // UUID reference
  name: string;
};

export type PersonType = {
  id: string; // UUID
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
};

export type MemberType = {
  id: string; // UUID
  team_id: string; // UUID reference
  person_id: string; // UUID reference
  role?: string;
};

export type ActionType = {
  id: string; // UUID
  team_id: string; // UUID reference
  equipement_id: string; // UUID reference
  type?: string | null;
  scheduled_time?: string | null;
  is_done?: number; // SQLite BOOLEAN as INTEGER 0/1
};

export type PointDetailType = {
  point: InterestPointsType;
  pictures: PictureType[];
  equipements: EquipementType[];
};
