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

  // ----------------------------
  // ⛔ Chargement initial — 1 seule fois
  // ----------------------------
  React.useEffect(() => {
    let didTimeout = false;

    const timer = setTimeout(() => {
      didTimeout = true;
      console.log("⏳ Timeout 10s → fallback Strasbourg");
      setCurrentRegion(defaultRegion);
      setLoading(false);
    }, 10000);

    const requestLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission refusée",
          "Impossible d'accéder à la localisation."
        );
        clearTimeout(timer);
        setCurrentRegion(defaultRegion);
        setLoading(false);
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });

        if (!didTimeout) {
          clearTimeout(timer);
          setCurrentRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
          setLoading(false);
        }
      } catch (error) {
        console.error("Erreur localisation :", error);
        if (!didTimeout) {
          clearTimeout(timer);
          setCurrentRegion(defaultRegion);
          setLoading(false);
        }
      }
    };

    const fetchInterestPoints = () => {
      try {
        const points = db.getAllSync<InterestPointsType>(
          "SELECT * FROM point ORDER BY id DESC"
        );
        console.log("📌 Points DB :", points);
        setListPoint(points); // pas de boucle car l’effet ne rerun jamais
      } catch (error) {
        console.error("Erreur DB :", error);
        setListPoint([]);
      }
    };

    requestLocation();
    fetchInterestPoints();

    return () => clearTimeout(timer);
  }, []); // ⛔ IMPORTANT : effet exécuté une seule fois

  // ----------------------------
  // TEMPLATE DES TUILES
  // ----------------------------
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

  // ----------------------------
  // LOADING
  // ----------------------------
  if (loading || !currentRegion) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ----------------------------
  // RENDER MAP
  // ----------------------------
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

        {/* Markers de la base */}
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
