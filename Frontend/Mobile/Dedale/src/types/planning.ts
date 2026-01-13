export type PlanningTeam = {
  id: string;
  name: string | null;
  number: number;
  event_id: string;
  members?: PlanningMember[];
};

export type PlanningMember = {
  id: string;
  team_id: string;
  person_id: string;
  firstname?: string;
  lastname?: string;
};

export type PlanningAction = {
  id: string;
  team_id: string;
  equipement_id: string;
  action_type: string | null;
  scheduled_time: string | null;
  is_done: boolean | null;
  equipement_name?: string;
};

export type RouteGuide = {
  startPoint: {
    id: string;
    name: string;
    x: number;
    y: number;
  };
  endPoint: {
    id: string;
    name: string;
    x: number;
    y: number;
  };
  distance: number;
  bearing: number;
};
