import React, { useEffect, useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import MapView, {
  Marker,
  Polyline,
  Region,
  UrlTile,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import * as Location from "expo-location";
import { InterestPointsType } from "../types/database";

export default function RouteNavigation() {
  const route = useRoute();
  const navigation = useNavigation();
  const points: InterestPointsType[] = (route.params as any)?.points ?? [];

  const [currentRegion, setCurrentRegion] = useState<Region | undefined>();
  const [currentLocation, setCurrentLocation] = useState<{
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
  }, []);

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
      <View style={styles.container}>
        <Text>Chargement de la carte...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
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
        <Pressable onPress={centerOnCurrentPoint} style={styles.recenterButton}>
          <Text style={styles.recenterButtonText}>📍 Recentrer</Text>
        </Pressable>
      )}

      {/* Back button */}
      <Pressable onPress={() => navigation.goBack()} className="back-btn">
        <Text className="back-btn-text">←</Text>
      </Pressable>

      {/* Navigation controls */}
      <View style={styles.controls}>
        <View style={styles.navigationInfo}>
          <Text style={styles.infoText}>
            Point {currentPointIndex + 1} / {points.length}
          </Text>
          <Text style={styles.pointName}>
            Point #{points[currentPointIndex].id}
          </Text>
        </View>

        <View style={styles.navigationButtons}>
          <Pressable
            onPress={goToPreviousPoint}
            style={[
              styles.navButton,
              currentPointIndex === 0 && styles.navButtonDisabled,
            ]}
            disabled={currentPointIndex === 0}
          >
            <Text style={styles.buttonText}>← Précédent</Text>
          </Pressable>

          <Pressable
            onPress={goToNextPoint}
            style={[
              styles.navButton,
              currentPointIndex === points.length - 1 &&
                styles.navButtonDisabled,
            ]}
            disabled={currentPointIndex === points.length - 1}
          >
            <Text style={styles.buttonText}>Suivant →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  navigationInfo: {
    alignItems: "center",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  pointName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  navigationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  navButton: {
    flex: 1,
    backgroundColor: "#3b82f6",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  navButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  recenterButton: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  recenterButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
});
