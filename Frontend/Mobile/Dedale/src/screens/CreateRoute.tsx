import React from "react";
import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function CreateRouteScreen() {
  const navigation = useNavigation();
  return (
    <View className="container">
      <Pressable onPress={() => navigation.goBack()} className="back-btn">
        <Text className="back-btn-text">←</Text>
      </Pressable>
      <Text>CreateRoute.tsx</Text>
    </View>
  );
}
