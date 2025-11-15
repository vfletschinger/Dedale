import React from "react";
import { View, StyleSheet, Text } from "react-native";
import MapView, { PROVIDER_DEFAULT } from "react-native-maps";

interface OfflineMapProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

export default function OfflineMap({ initialRegion }: OfflineMapProps) {
  // Région par défaut centrée sur Strasbourg
  const defaultRegion = {
    latitude: 48.5734,
    longitude: 7.7521,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const region = initialRegion || defaultRegion;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        rotateEnabled={true}
        pitchEnabled={false}
        mapType="standard"
        minZoomLevel={13}
        maxZoomLevel={18}
      />

      {/* Message d'info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>📍 Strasbourg</Text>
        <Text style={styles.infoSubtext}>
          Carte interactive • Localisation GPS active
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  infoBox: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  infoText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 14,
    color: "#6b7280",
  },
});
