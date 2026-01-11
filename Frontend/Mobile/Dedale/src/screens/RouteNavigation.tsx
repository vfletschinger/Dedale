import React, { useEffect, useState, useRef, useMemo } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { shortId } from "../services/Helper";
import MapView, {
  Marker,
  Polyline,
  Region,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import * as Location from "expo-location";

export function checkPointVisibility(
  point: { x: number; y: number },
  region: Region
): boolean {
  const latMin = region.latitude - region.latitudeDelta / 2;
  const latMax = region.latitude + region.latitudeDelta / 2;
  const lngMin = region.longitude - region.longitudeDelta / 2;
  const lngMax = region.longitude + region.longitudeDelta / 2;

  return (
    point.y >= latMin &&
    point.y <= latMax &&
    point.x >= lngMin &&
    point.x <= lngMax
  );
}

export async function fetchRouteCoordinates(
  points: { x: number; y: number }[]
): Promise<{ latitude: number; longitude: number }[]> {
  if (points.length < 2) {
    return points.map((p) => ({ latitude: p.y, longitude: p.x }));
  }

  try {
    const coordinates = points.map((point) => `${point.x},${point.y}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/foot/${coordinates}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map(
        (coord: [number, number]) => ({
          latitude: coord[1],
          longitude: coord[0],
        })
      );
    }
  } catch (error) {
    console.error("Error fetching route:", error);
  }

  return points.map((p) => ({ latitude: p.y, longitude: p.x }));
}

export default function RouteNavigation() {
  const route = useRoute();
  const navigation = useNavigation();
  const points = useMemo(
    () => (route.params as any)?.points ?? [],
    [route.params]
  ) as { x: number; y: number; id: number }[];

  const [currentRegion, setCurrentRegion] = useState<Region | undefined>();
  const [, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [isPointVisible, setIsPointVisible] = useState(true);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    const loadRoute = async () => {
        const coords = await fetchRouteCoordinates(points);
        setRouteCoordinates(coords);
    };
    loadRoute();
  }, [points]);

  useEffect(() => {
    const initializeLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission refusée",
          "Impossible d'accéder à la localisation."
        );
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const userLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        setCurrentLocation(userLocation);

        if (points.length > 0) {
          setCurrentRegion({
            latitude: points[0].y,
            longitude: points[0].x,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        } else {
          setCurrentRegion({
            ...userLocation,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      } catch (error) {
        console.error("Erreur localisation:", error);
      }
    };

    initializeLocation();

    const watchLocation = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (loc) => {
        setCurrentLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    );

    return () => {
      watchLocation.then((subscription) => subscription.remove());
    };
  }, [points]);

  const goToNextPoint = () => {
    if (currentPointIndex < points.length - 1) {
      const nextIndex = currentPointIndex + 1;
      setCurrentPointIndex(nextIndex);

      mapRef.current?.animateToRegion({
        latitude: points[nextIndex].y,
        longitude: points[nextIndex].x,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setIsPointVisible(true);
    } else {
      Alert.alert(
        "Terminé",
        "Vous avez atteint le dernier point de l'itinéraire !"
      );
    }
  };

  const goToPreviousPoint = () => {
    if (currentPointIndex > 0) {
      const prevIndex = currentPointIndex - 1;
      setCurrentPointIndex(prevIndex);

      mapRef.current?.animateToRegion({
        latitude: points[prevIndex].y,
        longitude: points[prevIndex].x,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setIsPointVisible(true);
    }
  };

  const handleRegionChangeComplete = (region: Region) => {
    if (points.length === 0) return;
    const currentPoint = points[currentPointIndex];
    const isVisible = checkPointVisibility(currentPoint, region);
    setIsPointVisible(isVisible);
  };

  const centerOnCurrentPoint = () => {
    if (points.length === 0) return;
    const currentPoint = points[currentPointIndex];
    mapRef.current?.animateToRegion({
      latitude: currentPoint.y,
      longitude: currentPoint.x,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setIsPointVisible(true);
  };

  if (!currentRegion || points.length === 0) {
    return (
      <View className="center">
        <Text>Chargement de la carte...</Text>
      </View>
    );
  }

  return (
    <View className="container-white">
      <MapView
        ref={mapRef}
        testID="map-view"
        className="flex-1"
        provider={PROVIDER_DEFAULT}
        initialRegion={currentRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#3b82f6"
            strokeWidth={4}
          />
        )}

        {points.map((point, index) => (
          <Marker
            key={point.id}
            coordinate={{ latitude: point.y, longitude: point.x }}
            pinColor={index === currentPointIndex ? "#3b82f6" : "#9ca3af"}
            title={`Point #${shortId(point.id)}`}
            description={
              index === currentPointIndex
                ? "Point actuel"
                : `Point ${index + 1}/${points.length}`
            }
          />
        ))}
      </MapView>

      {!isPointVisible && (
        <Pressable
          onPress={centerOnCurrentPoint}
          className="absolute top-16 right-5 bg-blue-500 py-3 px-4 rounded-3xl shadow-lg"
        >
          <Text className="text-white font-semibold text-sm">📍 Recentrer</Text>
        </Pressable>
      )}

      <Pressable onPress={() => navigation.goBack()} className="back-btn">
        <View className="back-btn-gray">
          <Text className="back-btn-gray-text">←</Text>
        </View>
      </Pressable>

      <View className="nav-controls">
        <View className="nav-info">
          <Text className="nav-info-text">
            Point {currentPointIndex + 1} / {points.length}
          </Text>
          <Text className="nav-point-name">
            Point #{shortId(points[currentPointIndex].id)}
          </Text>
        </View>

        <View className="nav-buttons">
          <Pressable
            onPress={goToPreviousPoint}
            className={currentPointIndex === 0 ? "nav-btn-disabled" : "nav-btn"}
            disabled={currentPointIndex === 0}
          >
            <Text className="nav-btn-text">← Précédent</Text>
          </Pressable>

          <Pressable
            onPress={goToNextPoint}
            className={
              currentPointIndex === points.length - 1
                ? "nav-btn-disabled"
                : "nav-btn"
            }
          >
            <Text className="nav-btn-text">Suivant →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
