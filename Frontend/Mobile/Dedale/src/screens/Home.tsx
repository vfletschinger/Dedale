import React from "react";
import Map from "../components/Map";

import "../style/global.css";
import { SafeAreaView, StatusBar, View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <SafeAreaView className="container-white">
      <View className="header header-row">
        <View className="row flex-1">
          <Text className="header-title">Home</Text>
        </View>
      </View>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Map />
    </SafeAreaView>
  );
}
