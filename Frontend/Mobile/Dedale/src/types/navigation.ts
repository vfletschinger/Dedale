export type TabParamList = {
  Accueil: undefined;
  "Points d'intérêt": undefined;  Planning: undefined;
  Paramètres: undefined;
};

export type RootStackParamList = {
  PointDetails: undefined;
  Tabs: undefined;
  RouteNavigation: undefined;
  ConnectEvent: undefined;
  TeamDetails: { teamId: string; teamName: string };
  TeamGuidance: { teamId: string; teamName: string };
};
