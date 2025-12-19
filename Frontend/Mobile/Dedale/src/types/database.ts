export type InterestPointsType = {
  id: string; // UUID
  event_id: string; // UUID reference to event
  x: number;
  y: number;
  comment?: string | null; // Integrated comment field
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
  description: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
};

export type ParcoursType = {
  id: string; // UUID
  event_id: string; // UUID reference
  wkt: string;
  created_at?: string;
};

export type ZoneType = {
  id: string; // UUID
  event_id: string; // UUID reference
  wkt: string;
  created_at?: string;
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
  point_id: string; // UUID reference
  type_id: number;
  quantity: number;
  name?: string; // From joined equipement_type
  description?: string;
  width?: number;
  length?: number;
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

export type PointDetailType = {
  point: InterestPointsType;
  pictures: PictureType[];
  equipements: EquipementType[];
};
