import "./src/style/global.css";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Feather from "@expo/vector-icons/Feather";
import Colors from "./src/constants/colors";
//import HomeScreen from "./src/screens/Home";
import PointDetails from "./src/screens/PointDetails";
import InterestPointsScreen from "./src/screens/InterestPoints";
import RegisterPointScreen from "./src/screens/RegisterPoint";
//import RouteNavigation from "./src/screens/RouteNavigation";
import ConnectEvent from "./src/screens/ConnectEvent";
import SettingsScreen from "./src/screens/Settings";
import PlanningScreen from "./src/screens/Planning";
//import TeamDetailsScreen from "./src/screens/TeamDetails";
import TeamGuidanceScreen from "./src/screens/TeamGuidance";

import type { TabParamList, RootStackParamList } from "./src/types/navigation";
import { NavigationContainer } from "@react-navigation/native";
import { useEffect, useState } from "react";
import getDatabase from "./assets/migrations";
import React from "react";
import { EventProvider } from "./src/context/EventContext";
import { PointsProvider } from "./src/context/PointsContext";
import { WebSocketProvider } from "./src/context/WebSocketContext";
import { GeometriesProvider } from "./src/context/GeometriesContext";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Accueil"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#FFD600",
        tabBarInactiveTintColor: "#FFFFFF",
        tabBarStyle: {
          backgroundColor: Colors.primary,
          borderTopColor: Colors.primaryDark,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Feather.glyphMap;

          if (route.name === "Accueil") {
            iconName = "plus-circle";
          } else if (route.name === "Points d'intérêt") {
            iconName = "map-pin";
          } else if (route.name === "Paramètres") {
            iconName = "settings";
          } else if (route.name === "Planning") {
            iconName = "calendar";
          } else {
            iconName = "list";
          }

          return <Feather name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil" component={RegisterPointScreen} />
      <Tab.Screen name="Points d'intérêt" component={InterestPointsScreen} />

      <Tab.Screen name="Planning" component={PlanningScreen} />
      <Tab.Screen name="Paramètres" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    async function initDatabase() {
      try {
        const db = getDatabase({ seed: __DEV__ });
        setDbReady(true);
      } catch (err) {
        console.error("Erreur initialisation DB:", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    }

    initDatabase();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WebSocketProvider>
        <EventProvider>
          <PointsProvider>
            <GeometriesProvider>
              <NavigationContainer>
                <Stack.Navigator initialRouteName="ConnectEvent">
                  <Stack.Screen
                    name="ConnectEvent"
                    component={ConnectEvent}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="Tabs"
                    component={TabNavigator}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="PointDetails"
                    component={PointDetails}
                    options={{ headerShown: false }}
                  />
                  {/*
                  <Stack.Screen
                    name="RouteNavigation"
                    component={RouteNavigation}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="TeamDetails"
                    component={TeamDetailsScreen}
                    options={{ headerShown: false }}
                  />*/}
                  <Stack.Screen
                    name="TeamGuidance"
                    component={TeamGuidanceScreen}
                    options={{ headerShown: false }}
                  />
                </Stack.Navigator>
              </NavigationContainer>
            </GeometriesProvider>
          </PointsProvider>
        </EventProvider>
      </WebSocketProvider>
    </GestureHandlerRootView>
  );
}
