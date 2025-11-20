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
import { InterestPointsType } from "../types/database";
import getDatabase from "../../assets/migrations";

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

  React.useEffect(() => {
    const fetchInterestPoints = () => {
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
    };

    const initialize = async () => {
      fetchInterestPoints();

      const locationPromise = async (): Promise<Region> => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission refusée",
            "Impossible d'accéder à la localisation."
          );
          return defaultRegion;
        }

        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          });
          return {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
        } catch (error) {
          console.error("Erreur localisation :", error);
          return defaultRegion;
        }
      };

      const timeoutPromise = new Promise<Region>((resolve) =>
        setTimeout(() => {
          console.log("⏳ Timeout 10s → fallback Strasbourg");
          resolve(defaultRegion);
        }, 10000)
      );

      const region = await Promise.race([locationPromise(), timeoutPromise]);
      setCurrentRegion(region);
      setLoading(false);
    };

    initialize();

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
        initialRegion={currentRegion}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        rotateEnabled
        pitchEnabled={false}
        mapType="none"
        minZoomLevel={13}
        maxZoomLevel={16}
      >
        <UrlTile
          urlTemplate={tileUrlTemplate}
          maximumZ={16}
          minimumZ={13}
          tileSize={256}
          shouldReplaceMapContent
        />
        {listPoint.map(
          (p) => (
            console.log(p),
            (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.x, longitude: p.y }}
                title={`${p.id}`}
                pinColor="blue"
              />
            )
          )
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  map: { width: "100%", height: "100%" },
});
