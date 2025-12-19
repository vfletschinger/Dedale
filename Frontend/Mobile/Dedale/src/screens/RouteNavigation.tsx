import React, { useEffect, useState, useRef, useMemo } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import MapView, {
  Marker,
  Polyline,
  Region,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import * as Location from "expo-location";

// Fonction utilitaire exportée pour les tests
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

// Fonction utilitaire exportée pour les tests
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

  // Fallback: lignes droites entre les points
  return points.map((p) => ({ latitude: p.y, longitude: p.x }));
}

export default function RouteNavigation() {
  const route = useRoute();
  const navigation = useNavigation();
  const points = useMemo(
    () => (route.params as any)?.points ?? [],
    [route.params]
  );

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

  // Fetch route following roads between points
  useEffect(() => {
    const fetchRoute = async () => {
      if (points.length < 2) {
        // If only one point, no route needed
        if (points.length === 1) {
          setRouteCoordinates([
            { latitude: points[0].y, longitude: points[0].x },
          ]);
        }
        return;
      }

      try {
        // Build coordinates string for OSRM API
        const coordinates = points
          .map((point) => `${point.x},${point.y}`)
          .join(";");

        // Use OSRM demo server (consider self-hosting for production)
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
        );

        const data = await response.json();

        if (data.code === "Ok" && data.routes && data.routes.length > 0) {
          // Convert GeoJSON coordinates to React Native Maps format
          const coords = data.routes[0].geometry.coordinates.map(
            (coord: [number, number]) => ({
              longitude: coord[0],
              latitude: coord[1],
            })
          );
          setRouteCoordinates(coords);
        } else {
          // Fallback to straight lines if routing fails
          console.warn("Routing failed, using straight lines");
          setRouteCoordinates(
            points.map((point) => ({ latitude: point.y, longitude: point.x }))
          );
        }
      } catch (error) {
        console.error("Error fetching route:", error);
        // Fallback to straight lines
        setRouteCoordinates(
          points.map((point) => ({ latitude: point.y, longitude: point.x }))
        );
      }
    };

    fetchRoute();
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

        // Center on first point or user location
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

    // Watch user position
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
    // Check if current point is visible in the map region
    const currentPoint = points[currentPointIndex];
    const latDelta = region.latitudeDelta / 2;
    const lonDelta = region.longitudeDelta / 2;

    const isVisible =
      currentPoint.y >= region.latitude - latDelta &&
      currentPoint.y <= region.latitude + latDelta &&
      currentPoint.x >= region.longitude - lonDelta &&
      currentPoint.x <= region.longitude + lonDelta;

    setIsPointVisible(isVisible);
  };

  const centerOnCurrentPoint = () => {
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
        <Text className="text-gray-500">Chargement de la carte...</Text>
      </View>
    );
  }

  return (
    <View className="container-white">
      <MapView
        ref={mapRef}
        className="flex-1"
        provider={PROVIDER_DEFAULT}
        initialRegion={currentRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {/* Draw route polyline following roads */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#3b82f6"
            strokeWidth={4}
          />
        )}

        {/* Show all points as markers */}
        {points.map((point, index) => (
          <Marker
            key={point.id}
            coordinate={{ latitude: point.y, longitude: point.x }}
            pinColor={index === currentPointIndex ? "#3b82f6" : "#9ca3af"}
            title={`Point #${point.id}`}
            description={
              index === currentPointIndex
                ? "Point actuel"
                : `Point ${index + 1}/${points.length}`
            }
          />
        ))}
      </MapView>

      {/* Recenter button - only shown when current point is not visible */}
      {!isPointVisible && (
        <Pressable
          onPress={centerOnCurrentPoint}
          className="absolute top-16 right-5 bg-blue-500 py-3 px-4 rounded-3xl shadow-lg"
        >
          <Text className="text-white font-semibold text-sm">📍 Recentrer</Text>
        </Pressable>
      )}

      {/* Back button */}
      <Pressable onPress={() => navigation.goBack()} className="back-btn">
        <View className="back-btn-gray">
          <Text className="back-btn-gray-text">←</Text>
        </View>
      </Pressable>

      {/* Navigation controls */}
      <View className="nav-controls">
        <View className="nav-info">
          <Text className="nav-info-text">
            Point {currentPointIndex + 1} / {points.length}
          </Text>
          <Text className="nav-point-name">
            Point #{points[currentPointIndex].id}
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
            disabled={currentPointIndex === points.length - 1}
          >
            <Text className="nav-btn-text">Suivant →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
