export type Action = {
  id: string;
  team_id: string;
  equipement_id: string;
  action_type: string;
  scheduled_time: string;
  is_done: boolean;
};
export type TransferPhase = "idle" | "qr_displayed" | "connected";

export type Team = {
  id: string;
  name: string;
  event_id: string;
};

export type TeamWithActions = Team & {
  actions: Action[];
};

export type Equipement = {
  id: string;
  event_id: string;
  type_id: string;
  quantity: number;
  length_per_unit: number;
  date_pose: string | null;
  date_depose: string | null;
  coordinates: TransferEquipementCoordinate[];
}
export type TransferEquipementCoordinate = {
  id: string;
  equipement_id: string;
  x: number;
  y: number;
  order_index: number | null;
}

export type TransferTeamInfo = {
  id: string;
  name: string;
  eventId: string;
}

export type Planning = {
  team: TransferTeamInfo;
  actions: Action[];
  equipements: Equipement[];
  coordonees: TransferEquipementCoordinate[];
}