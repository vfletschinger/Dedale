import * as React from "react";
import { View, Alert, ActivityIndicator, StyleSheet } from "react-native";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  Region,
  Polygon,
  Polyline,
  MapPressEvent,
} from "react-native-maps";
import * as Location from "expo-location";
import { InterestPointsType, GeometryType } from "../types/database";
import CustomButton from "./CustomButton";
import { useEvent } from "../context/EventContext";
import { usePoints } from "../context/PointsContext";
import { useGeometries } from "../context/GeometriesContext";
import { getShortAddressFromCoords } from "../services/Helper";

// Fonction utilitaire exportée pour les tests
export const parseWKT = (wkt: string) => {
  if (!wkt || wkt.trim() === '') return null;

  const trimmed = wkt.trim();

  if (trimmed.startsWith("POLYGON")) {
    const coordsMatch = trimmed.match(/\(\((.+?)\)\)/);
    if (!coordsMatch) return null;

    const coords = coordsMatch[1].split(",").map((pair) => {
      const [lng, lat] = pair.trim().split(" ").map(Number);
      return { latitude: lat, longitude: lng };
    });
    return { type: "polygon", coordinates: coords };
  }

  if (trimmed.startsWith("LINESTRING")) {
    const coordsMatch = trimmed.match(/\((.+?)\)/);
    if (!coordsMatch) return null;

    const coords = coordsMatch[1].split(",").map((pair) => {
      const [lng, lat] = pair.trim().split(" ").map(Number);
      return { latitude: lat, longitude: lng };
    });
    return { type: "linestring", coordinates: coords };
  }

  if (trimmed.startsWith("POINT")) {
    const coordsMatch = trimmed.match(/\((.+?)\)/);
    if (!coordsMatch) return null;

    const [lng, lat] = coordsMatch[1].trim().split(" ").map(Number);
    return {
      type: "point",
      coordinates: [{ latitude: lat, longitude: lng }],
    };
  }

  return null;
};

interface OfflineMapProps {
  initialRegion?: Region;
  onMapPress?: (event: MapPressEvent) => void;
  customMarker?: React.ReactNode;
  hideDefaultMarkers?: boolean;
  hideButtons?: boolean;
  mapRef?: React.RefObject<MapView | null>;
}

export default function OfflineMap({
  initialRegion,
  onMapPress,
  customMarker,
  hideDefaultMarkers = false,
  hideButtons = false,
  mapRef: externalMapRef,
}: OfflineMapProps) {
  const colors = [
    "#FF0000", // Rouge
    "#0000FF", // Bleu
    "#00FF00", // Vert
    "#FF00FF", // Magenta
    "#FFA500", // Orange
    "#800080", // Violet
    "#00FFFF", // Cyan
    "#FFD700", // Or
    "#FF1493", // Rose foncé
  ];

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
  const [listGeometry, setListGeometry] = React.useState<GeometryType[]>([]);
  const [pointAddresses, setPointAddresses] = React.useState<Record<string, string>>({});

  const internalMapRef = React.useRef<MapView | null>(null);
  const mapRef = externalMapRef || internalMapRef;
  const { selectedEventId } = useEvent();
  const { pointsByEvent, loading: pointsLoading } = usePoints();
  const { geometriesByEvent, loading: geometriesLoading } = useGeometries();

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
  }, [selectedEventId, pointsByEvent, mapRef]);

  React.useEffect(() => {
    if (selectedEventId && geometriesByEvent[selectedEventId]) {
      setListGeometry(geometriesByEvent[selectedEventId]);
    } else {
      setListGeometry([]);
    }
  }, [selectedEventId, geometriesByEvent]);

  // Fetch addresses for all points
  React.useEffect(() => {
    const fetchAddresses = async () => {
      const newAddresses: Record<string, string> = {};
      for (const point of listPoint) {
        const address = await getShortAddressFromCoords(point.y, point.x);
        newAddresses[point.id] = address || "Adresse inconnue";
      }
      setPointAddresses(newAddresses);
    };
    if (listPoint.length > 0) {
      fetchAddresses();
    }
  }, [listPoint]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        ref={(ref) => {
          if (mapRef && "current" in mapRef) {
            (mapRef as React.MutableRefObject<MapView | null>).current = ref;
          }
        }}
        initialRegion={currentRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        rotateEnabled
        pitchEnabled={true}
        mapType="standard"
        minZoomLevel={0}
        maxZoomLevel={20}
        toolbarEnabled={false}
        onPress={onMapPress}
      >
        {!hideDefaultMarkers &&
          listPoint.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ longitude: p.x, latitude: p.y }}
              title={p.name || "Point sans nom"}
              description={pointAddresses[p.id] || "Chargement..."}
            />
          ))}
        {listGeometry.map((geom, index) => {
          const parsed = parseWKT(geom.wkt);
          if (!parsed) return null;

          const color = colors[index % colors.length];

          if (parsed.type === "polygon") {
            const fillColor = color
              .replace("#", "")
              .match(/.{2}/g)
              ?.map((hex) => parseInt(hex, 16))
              .join(", ");

            return (
              <Polygon
                key={`geom-${geom.id}`}
                coordinates={parsed.coordinates}
                strokeColor={color}
                strokeWidth={2}
                fillColor={`rgba(${fillColor}, 0.3)`}
              />
            );
          }

          if (parsed.type === "linestring") {
            return (
              <Polyline
                key={`geom-${geom.id}`}
                coordinates={parsed.coordinates}
                strokeColor={color}
                strokeWidth={3}
              />
            );
          }

          if (parsed.type === "point") {
            return (
              <Marker
                key={`geom-${geom.id}`}
                coordinate={parsed.coordinates[0]}
                pinColor="green"
              />
            );
          }

          return null;
        })}
        {customMarker}
      </MapView>
      {(pointsLoading || geometriesLoading) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      )}
      {!hideButtons && (
        <View style={styles.overlay}>
          <CustomButton title="Center" onPress={centerOnUserLocation} />
        </View>
      )}
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
