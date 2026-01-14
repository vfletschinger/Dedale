import React from "react";
import Map from "../components/Map";

import { View, StatusBar, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-white">
      <View className="bg-primary pt-4 pb-4 px-4 shadow-sm flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <Text className="text-accent text-2xl font-bold">Home</Text>
        </View>
      </View>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Map />
    </View>
  );
}
