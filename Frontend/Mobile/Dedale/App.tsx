import "./src/style/global.css"; 
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "./src/screens/Home";
import PointDetails from "./src/screens/PointDetails";
import InterestPointsScreen from "./src/screens/InterestPoints";
import RegisterPointScreen from "./src/screens/RegisterPoint";

import type { TabParamList, RootStackParamList } from "./src/types/navigation";
import { NavigationContainer } from "@react-navigation/native";
import { useEffect, useState } from "react";
import getDatabase from "./assets/migrations";
import React from "react";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="InterestPoints" component={InterestPointsScreen} />
      <Tab.Screen name="RegisterPoint" component={RegisterPointScreen} />
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
         if (__DEV__) {
           const { resetAndSeed } = await import('./assets/migrations/seeders');
          resetAndSeed(db);
         }
        setDbReady(true);
      } catch (err) {
        console.error('Erreur initialisation DB:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    }

    initDatabase();
  }, []);
  return (
    <NavigationContainer>
      <Stack.Navigator>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
