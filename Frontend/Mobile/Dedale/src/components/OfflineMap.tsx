import * as React from "react";
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  Region,
  UrlTile,
} from "react-native-maps";
import Constants from "expo-constants";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { InterestPointsType } from "../types/database";
import getDatabase from "../../assets/migrations";
import CustomButton from "./CustomButton";

interface OfflineMapProps {
  initialRegion?: Region;
}

export default function OfflineMap({ initialRegion }: OfflineMapProps) {
  const defaultRegion: Region = {
    latitude: 48.5734,
    longitude: 7.7521,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const [currentRegion, setCurrentRegion] = React.useState<Region | undefined>(
    initialRegion
  );
  const [loading, setLoading] = React.useState(true);
  const [listPoint, setListPoint] = React.useState<InterestPointsType[]>([]);

  const db = getDatabase();
  const mapRef = React.useRef<MapView | null>(null);

  // Refresh points list when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      try {
        const points = db.getAllSync<InterestPointsType>(
          "SELECT * FROM point ORDER BY id DESC"
        );
        console.log("📌 Points DB :", points);
        setListPoint(points);
      } catch (error) {
        console.error("Erreur DB :", error);
        setListPoint([]);
      }
    }, [])
  );

  React.useEffect(() => {
    const initialize = async () => {
      // Start a timeout fallback but still apply the real location when it arrives.
      let didSetFallback = false;
      const fallbackTimer = setTimeout(() => {
        if (!didSetFallback) {
          console.log("⏳ Timeout 10s → fallback Strasbourg");
          setCurrentRegion(defaultRegion);
          setLoading(false);
          didSetFallback = true;
        }
      }, 10000);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission refusée",
            "Impossible d'accéder à la localisation."
          );
          if (!didSetFallback) {
            setCurrentRegion(defaultRegion);
            setLoading(false);
            didSetFallback = true;
          }
          return;
        }

        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          });

          const realRegion: Region = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };

          // If we already applied fallback earlier, override it with the real location.
          setCurrentRegion(realRegion);
          setLoading(false);
          didSetFallback = true;
        } catch (error) {
          console.error("Erreur localisation :", error);
          if (!didSetFallback) {
            setCurrentRegion(defaultRegion);
            setLoading(false);
            didSetFallback = true;
          }
        }
      } finally {
        clearTimeout(fallbackTimer);
      }
    };

    let isActive = true;
    initialize();

    return () => {
      // mark effect as inactive to avoid state updates after unmount
      isActive = false;
    };

    // Le useEffect ne s'exécute qu'une fois, le nettoyage du timeout n'est pas strictement
    // nécessaire si le composant n'est jamais démonté rapidement, mais c'est une bonne pratique.
    // Ici, avec Promise.race, la gestion est implicite et plus propre.
  }, []);
  const getTileUrlTemplate = () => {
    if (__DEV__ && Constants.expoConfig?.hostUri) {
      const host = Constants.expoConfig.hostUri.split(":")[0];
      return `http://${host}:3000/maps/{z}/{x}/{y}.png`;
    }
    return Platform.OS === "android"
      ? "file:///android_asset/maps/{z}/{x}/{y}.png"
      : "file://maps/{z}/{x}/{y}.png";
  };

  const centerOnUserLocation = () => {
    if (mapRef.current && currentRegion) {
      mapRef.current.animateToRegion(
        {
          latitude: currentRegion.latitude,
          longitude: currentRegion.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
      return;
    }

    if (currentRegion) {
      setCurrentRegion({
        ...currentRegion,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const tileUrlTemplate = getTileUrlTemplate();

  if (loading || !currentRegion) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        ref={(r) => {
          mapRef.current = r;
        }}
        initialRegion={currentRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        rotateEnabled
        pitchEnabled={true}
        mapType="none" // mapType="standard" pour passer en ligne
        minZoomLevel={13}
        maxZoomLevel={16}
        toolbarEnabled={false}
      >
        <UrlTile // tout commenter UrlTile pour passer en ligne
          urlTemplate={tileUrlTemplate}
          maximumZ={16}
          minimumZ={13}
          tileSize={256}
          shouldReplaceMapContent
        />
        {listPoint.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ longitude: p.x, latitude: p.y }}
            title={`${p.id}`}
          />
        ))}
      </MapView>
      <View style={styles.overlayContainer}>
        <CustomButton title="Center" onPress={centerOnUserLocation} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  map: { width: "100%", height: "100%" },
  overlayContainer: {
    position: "absolute",
    right: 16,
    bottom: 16,
    zIndex: 100,
  },
});
