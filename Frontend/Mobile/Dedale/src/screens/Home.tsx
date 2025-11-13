import { View, Text, Pressable } from "react-native";

import "../style/global.css";
import CustomButton from "../components/CustomButton";

export default function HomeScreen() {
  return (
    <View className="container">
      <Text className="text-xl font-bold text-blue-500">Welcome to Dedale</Text>

    </View>
  );
}
