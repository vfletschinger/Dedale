import * as React from "react";
import {
  View,
  Alert,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  Region,
  Polygon,
} from "react-native-maps";
import * as Location from "expo-location";
import { InterestPointsType } from "../types/database";
import CustomButton from "./CustomButton";
import { useEvent } from "../context/EventContext";
import { usePoints } from "../context/PointsContext";

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
  const [initialLocationLoading, setInitialLocationLoading] =
    React.useState(true);
  const [listPoint, setListPoint] = React.useState<InterestPointsType[]>([]);

  const mapRef = React.useRef<MapView | null>(null);
  const { selectedEventId } = useEvent();
  const { pointsByEvent, loading: pointsLoading } = usePoints();

  React.useEffect(() => {
    if (selectedEventId && pointsByEvent[selectedEventId]) {
      const points = pointsByEvent[selectedEventId];
      setListPoint(points);

      if (points.length > 0 && mapRef.current) {
        const firstPoint = points[0];
        mapRef.current.animateToRegion(
          {
            latitude: firstPoint.y,
            longitude: firstPoint.x,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500
        );
      }
    } else {
      setListPoint([]);
    }
  }, [selectedEventId, pointsByEvent]);

  React.useEffect(() => {
    const initialize = async () => {
      let didSetFallback = false;
      const fallbackTimer = setTimeout(() => {
        if (!didSetFallback) {
          console.log("⏳ Timeout 10s → fallback Strasbourg");
          setCurrentRegion(defaultRegion);
          setInitialLocationLoading(false);
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
            setInitialLocationLoading(false);
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

          setCurrentRegion(realRegion);
          setInitialLocationLoading(false);
          didSetFallback = true;
        } catch (error) {
          console.error("Erreur localisation :", error);
          if (!didSetFallback) {
            setCurrentRegion(defaultRegion);
            setInitialLocationLoading(false);
            didSetFallback = true;
          }
        }
      } finally {
        clearTimeout(fallbackTimer);
      }
    };

    initialize();
  }, []);

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
    }
  };

  if (initialLocationLoading || !currentRegion) {
    return (
      <View style={styles.container}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        ref={mapRef}
        initialRegion={currentRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        rotateEnabled
        pitchEnabled={true}
        mapType="standard"
        minZoomLevel={10}
        maxZoomLevel={25}
        toolbarEnabled={false}
      >
        {listPoint.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ longitude: p.x, latitude: p.y }}
            title={`${p.id}`}
          />
        ))}
      </MapView>
      {pointsLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      )}
      <View style={styles.overlay}>
        <CustomButton title="Center" onPress={centerOnUserLocation} />
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
  overlay: {
    position: "absolute",
    right: 16,
    bottom: 16,
    zIndex: 100,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
});
