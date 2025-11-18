import React from "react";
import { View, Text, StyleSheet } from "react-native";
import OfflineMap from "../components/OfflineMap";

import "../style/global.css";
import CustomButton from "../components/CustomButton";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <OfflineMap
        initialRegion={{
          latitude: 48.5734, // Centre de Strasbourg
          longitude: 7.7521,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerText}>Dedale</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none",
  },
  headerContent: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3b82f6",
  },
});
