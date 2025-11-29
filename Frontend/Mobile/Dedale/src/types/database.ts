export type InterestPointsType = {
  id: number;
  x: number;
  y: number;
  event_id?: number; // Optional - populated from junction table when querying with event context
};

export type CommentType = {
  id: number;
  point_id: number;
  value: string;
};

export type PictureType = {
  id: number;
  point_id: number;
  image: string;
};

export type EventType = {
  id: number;
  name: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
  geometry: string | null;
};

export type ObstacleType = {
  id: number;
  point_id: number;
  type_id: number;
  number: number;
  name?: string;
  description?: string;
  width?: number;
  length?: number;
};

export type PointDetailType = {
  point: InterestPointsType;
  comments: CommentType[];
  pictures: PictureType[];
  obstacles: ObstacleType[];
};
