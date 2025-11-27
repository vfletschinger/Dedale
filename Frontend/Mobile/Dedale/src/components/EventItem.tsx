import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "react-native";

export default function EventItem() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Event Item</Text>
      <Text style={styles.description}>
        This is a placeholder for the Event Item component.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#666",
  },
});
