import * as React from "react";
import { View, StyleSheet, Text, Platform } from "react-native";
import MapView, { PROVIDER_DEFAULT, UrlTile } from "react-native-maps";
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
  const [tileUrlTemplate, setTileUrlTemplate] = React.useState<string>("");

  // Région par défaut centrée sur Strasbourg
  const defaultRegion = {
    latitude: 48.5734,
    longitude: 7.7521,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const region = initialRegion || defaultRegion;

  React.useEffect(() => {
    // Déterminer l'URL de base pour les tuiles
    if (__DEV__) {
      // En mode développement avec Expo Go, utiliser un serveur local
      const manifest = Constants.expoConfig;
      const hostUri = manifest?.hostUri;
      if (hostUri) {
        // Utiliser le serveur de tuiles sur le port 3000
        const host = hostUri.split(":")[0];
        const baseUrl = `http://${host}:3000/maps`;
        setTileUrlTemplate(`${baseUrl}/{z}/{x}/{y}.png`);
        console.log("Mode Expo Go - URL tuiles:", baseUrl);
      }
    } else {
      // En production, utiliser les assets natifs
      const path =
        Platform.select({
          android: "file:///android_asset/maps/{z}/{x}/{y}.png",
          ios: "file://maps/{z}/{x}/{y}.png",
        }) || "file:///android_asset/maps/{z}/{x}/{y}.png";
      setTileUrlTemplate(path);
    }
  }, []);

  const handleRegionChange = (region: any) => {
    const zoom = Math.round(Math.log(360 / region.longitudeDelta) / Math.LN2);
    console.log(
      `Région changée - Zoom: ${zoom}, Centre: ${region.latitude.toFixed(4)}, ${region.longitude.toFixed(4)}`
    );
    if (tileUrlTemplate) {
      console.log(
        `Exemple tuile à charger: ${tileUrlTemplate.replace("{z}", zoom.toString())}`
      );
    }
  };

  if (!tileUrlTemplate) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text>Chargement de la carte...</Text>
      </View>
    );
  }

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
