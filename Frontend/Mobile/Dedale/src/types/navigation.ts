export type TabParamList = {
  Home: undefined;
  InterestPoints: undefined;
  RegisterPoint: undefined;
  Planning: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  PointDetails: undefined;
  Tabs: undefined;
  RouteNavigation: undefined;
  ConnectEvent: undefined;
  TeamDetails: { teamId: string; teamName: string };
  TeamGuidance: { teamId: string; teamName: string };
};
