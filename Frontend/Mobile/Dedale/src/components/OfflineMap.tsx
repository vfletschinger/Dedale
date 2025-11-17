import * as React from "react";
import { View, StyleSheet, Text, Platform } from "react-native";
import MapView, { PROVIDER_DEFAULT, Region, UrlTile } from "react-native-maps";
import Constants from "expo-constants";

interface OfflineMapProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

export default function OfflineMap({ initialRegion }: OfflineMapProps) {
  // Default region centered on Strasbourg
  const defaultRegion = {
    latitude: 48.5734,
    longitude: 7.7521,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
  const region = initialRegion || defaultRegion;

  // Determine the tile URL template based on the environment.
  // This logic runs only once per render, simplifying the component.
  const getTileUrlTemplate = () => {
    if (__DEV__ && Constants.expoConfig?.hostUri) {
      // In development with Expo Go, use a local tile server.
      const host = Constants.expoConfig.hostUri.split(":")[0];
      const baseUrl = `http://${host}:3000/maps`;
      console.log("Expo Go mode - Tile URL:", baseUrl);
      return `${baseUrl}/{z}/{x}/{y}.png`;
    }
    // In production, use native assets.
    return Platform.OS === "android"
      ? "file:///android_asset/maps/{z}/{x}/{y}.png"
      : "file://maps/{z}/{x}/{y}.png";
  };

  const tileUrlTemplate = getTileUrlTemplate();

  const handleRegionChange = (region: Region) => {
    const zoom = Math.round(Math.log(360 / region.longitudeDelta) / Math.LN2);
    console.log(
      `Region changed - Zoom: ${zoom}, Center: ${region.latitude.toFixed(4)}, ${region.longitude.toFixed(4)}`
    );
  };

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
        mapType="none"
        minZoomLevel={13}
        maxZoomLevel={16}
        onRegionChangeComplete={handleRegionChange}
      >
        <UrlTile
          urlTemplate={tileUrlTemplate}
          maximumZ={16}
          minimumZ={13}
          tileSize={256}
          shouldReplaceMapContent={true}
        />
      </MapView>
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
