import "./src/style/global.css";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Feather from "@expo/vector-icons/Feather";
import HomeScreen from "./src/screens/Home";
import PointDetails from "./src/screens/PointDetails";
import InterestPointsScreen from "./src/screens/InterestPoints";
import RegisterPointScreen from "./src/screens/RegisterPoint";
import RouteNavigation from "./src/screens/RouteNavigation";
import ConnectEvent from "./src/screens/ConnectEvent";
import SettingsScreen from "./src/screens/Settings";

import type { TabParamList, RootStackParamList } from "./src/types/navigation";
import { NavigationContainer } from "@react-navigation/native";
import { useEffect, useState } from "react";
import getDatabase from "./assets/migrations";
import React from "react";
import CreateRouteScreen from "./src/screens/CreateRoute";
import { EventProvider } from "./src/context/EventContext";
import { PointsProvider } from "./src/context/PointsContext";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName: string;

          if (route.name === "Home") {
            iconName = "home";
          } else if (route.name === "InterestPoints") {
            iconName = "map-pin";
          } else if (route.name === "RegisterPoint") {
            iconName = "plus-circle";
          } else if (route.name === "Settings") {
            iconName = "settings";
          } else {
            iconName = "list";
          }

          return <Feather name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="InterestPoints" component={InterestPointsScreen} />
      <Tab.Screen name="RegisterPoint" component={RegisterPointScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    async function initDatabase() {
      try {
        const db = getDatabase();
        // if (__DEV__) {
        //   const { resetAndSeed } = await import("./assets/migrations/seeders");
        //   resetAndSeed(db);
        // }
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
      <EventProvider>
        <PointsProvider>
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
              <Stack.Screen
                name="CreateRoute"
                component={CreateRouteScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="RouteNavigation"
                component={RouteNavigation}
                options={{ headerShown: false }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </PointsProvider>
      </EventProvider>
    </GestureHandlerRootView>
  );
}
