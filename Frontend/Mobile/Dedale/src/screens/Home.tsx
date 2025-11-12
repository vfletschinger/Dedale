import { View, Text, StyleSheet } from "react-native";
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text>Welcome to Dedale</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
