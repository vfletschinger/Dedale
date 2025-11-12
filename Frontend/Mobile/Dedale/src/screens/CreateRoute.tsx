import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Pressable } from "react-native";

export default function CreateRouteScreen() {
  const navigation = useNavigation();
  return (
    <View className="container">
      <Pressable onPress={() => navigation.goBack()} className="back-btn">
        <Text className="back-btn-text">←</Text>
      </Pressable>
    </View>
  );
}
