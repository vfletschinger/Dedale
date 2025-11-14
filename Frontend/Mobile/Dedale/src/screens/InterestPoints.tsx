import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Pressable } from "react-native";

export default function InterestPointsScreen() {
  const navigation = useNavigation();
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text>Welcome to the Interest Points Screen</Text>
      <Pressable
        onPress={() => navigation.navigate("CreateRoute" as never)}
        className="btn"
      >
        <Text className="btn-text">Press Me</Text>
      </Pressable>    

    </View>
  );
}
