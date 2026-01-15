import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import * as Location from "expo-location";
import { getDatabase } from "../../assets/migrations";
import Colors from "../constants/colors";

interface ActionWithPoint {
  id: string;
  team_id: string;
  equipement_id: string;
  type: string | null;
  scheduled_time: string | null;
  is_done: number;
  equipement_name?: string;
  point_x: number | null;
  point_y: number | null;
  point_name: string | null;
}

type TeamGuidanceRouteParams = {
  TeamGuidance: {
    teamId: string;
    teamName: string;
  };
};

export default function TeamGuidanceScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<TeamGuidanceRouteParams, "TeamGuidance">>();
  const { teamId, teamName } = route.params;

  const mapRef = useRef<MapView>(null);
  const [actions, setActions] = useState<ActionWithPoint[]>([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const lastRouteUpdate = useRef<number>(0);
  const proximityValidatedRef = useRef<Set<string>>(new Set()); // Pour éviter les validations multiples

  const PROXIMITY_THRESHOLD = 20;

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const earthRadius = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
  };

  const getActionTypeLabel = (type: string | null) => {
    switch (type) {
      case "pose":
        return "Pose";
      case "retrait":
        return "Retrait";
      case "déploiement":
        return "Déploiement";
      case "inspection":
        return "Inspection";
      default:
        return type || "Action";
    }
  };

  useEffect(() => {
    loadActionsAndLocation();
  }, [teamId]);

  useEffect(() => {
    const currentAction = actions[currentActionIndex];
    if (userLocation && currentAction?.point_x && currentAction?.point_y) {
      const now = Date.now();
      if (
        now - lastRouteUpdate.current > 10000 ||
        routeCoordinates.length === 0
      ) {
        lastRouteUpdate.current = now;
        fetchRoute(
          userLocation.longitude,
          userLocation.latitude,
          currentAction.point_x,
          currentAction.point_y
        );
      }
    }
  }, [userLocation, currentActionIndex, actions]);

  useEffect(() => {
    const currentAction = actions[currentActionIndex];
    if (!userLocation || !currentAction?.point_x || !currentAction?.point_y)
      return;
    if (currentAction.is_done) return;
    if (proximityValidatedRef.current.has(currentAction.id)) return;

    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      currentAction.point_y,
      currentAction.point_x
    );

    if (distance <= PROXIMITY_THRESHOLD) {
      proximityValidatedRef.current.add(currentAction.id);

      Alert.alert(
        "📍 Vous êtes arrivé !",
        `Vous êtes à proximité de "${currentAction.point_name || getActionTypeLabel(currentAction.type)}". Valider l'action ?`,
        [
          {
            text: "Pas encore",
            style: "cancel",
            onPress: () => {
              setTimeout(() => {
                proximityValidatedRef.current.delete(currentAction.id);
              }, 30000);
            },
          },
          {
            text: "Valider ✓",
            onPress: () => markActionAsDone(currentAction),
          },
        ]
      );
    }
  }, [userLocation, currentActionIndex, actions]);

  useEffect(() => {
    const currentAction = actions[currentActionIndex];
    if (userLocation && currentAction?.point_x && currentAction?.point_y) {
      lastRouteUpdate.current = Date.now();
      fetchRoute(
        userLocation.longitude,
        userLocation.latitude,
        currentAction.point_x,
        currentAction.point_y
      );
    }
  }, [currentActionIndex]);

  const fetchRoute = async (
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number
  ) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(
          (coord: [number, number]) => ({
            latitude: coord[1],
            longitude: coord[0],
          })
        );
        setRouteCoordinates(coordinates);
        setRouteDistance(route.distance);
        setRouteDuration(route.duration);
        console.log(
          "🗺️ Route chargée:",
          coordinates.length,
          "points,",
          route.distance,
          "m"
        );
      } else {
        console.log("⚠️ Pas de route trouvée, utilisation ligne directe");
        setRouteCoordinates([
          { latitude: startLat, longitude: startLng },
          { latitude: endLat, longitude: endLng },
        ]);
        setRouteDistance(null);
        setRouteDuration(null);
      }
    } catch (error) {
      console.error("Erreur récupération itinéraire:", error);
      setRouteCoordinates([
        { latitude: startLat, longitude: startLng },
        { latitude: endLat, longitude: endLng },
      ]);
    }
  };

  const loadActionsAndLocation = async () => {
    try {
      const db = getDatabase();

      const team = db.getFirstSync<{ event_id: string }>(
        "SELECT event_id FROM team WHERE id = ?",
        [teamId]
      );

      if (!team) {
        console.error("❌ Équipe non trouvée");
        setLoading(false);
        return;
      }

      console.log("📍 Event ID:", team.event_id);

      const actionsResult = db.getAllSync<ActionWithPoint>(
        `SELECT a.*, 
                t.name as equipement_name,
                ec.x as coord_x,
                ec.y as coord_y
         FROM action a 
         LEFT JOIN equipement e ON a.equipement_id = e.id
         LEFT JOIN type t ON e.type_id = t.id
         LEFT JOIN equipement_coordinate ec ON ec.equipement_id = e.id AND ec.order_index = 0
         WHERE a.team_id = ?
         ORDER BY a.scheduled_time ASC`,
        [teamId]
      );

      console.log("📍 Actions chargées:", actionsResult?.length || 0);
      if (actionsResult && actionsResult.length > 0) {
        console.log("📍 Première action:", JSON.stringify(actionsResult[0]));
      }

      if (actionsResult && actionsResult.length > 0) {
        const actionsWithPoints = actionsResult.map((action, index) => {
          let x = (action as any).coord_x;
          let y = (action as any).coord_y;

          if (!x || !y) {
            const eventPoints = db.getAllSync<{
              x: number;
              y: number;
              name: string;
            }>(
              "SELECT x, y, name FROM point WHERE event_id = ? LIMIT 1 OFFSET ?",
              [team.event_id, index]
            );
            if (eventPoints && eventPoints.length > 0) {
              x = eventPoints[0].x;
              y = eventPoints[0].y;
            }
          }

          if (!x || !y) {
            x = 7.7521 + index * 0.001;
            y = 48.5734 + index * 0.001;
          }

          return {
            ...action,
            point_x: x,
            point_y: y,
            point_name:
              action.point_name ||
              action.equipement_name ||
              `Action ${index + 1}`,
          };
        });

        console.log(
          "📍 Actions avec points:",
          JSON.stringify(actionsWithPoints[0])
        );
        console.log(
          "📍 Coordonnées action 0: x=",
          actionsWithPoints[0].point_x,
          "y=",
          actionsWithPoints[0].point_y
        );
        setActions(actionsWithPoints);

        const firstPendingIndex = actionsWithPoints.findIndex(
          (a) => !a.is_done
        );
        setCurrentActionIndex(firstPendingIndex >= 0 ? firstPendingIndex : 0);
      } else {
        setActions([]);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        );
      }
    } catch (error) {
      console.error("Erreur chargement guidage:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentAction = () => {
    return actions[currentActionIndex] || null;
  };

  const markActionAsDone = (action: ActionWithPoint) => {
    const db = getDatabase();
    db.runSync("UPDATE action SET is_done = 1 WHERE id = ?", [action.id]);

    const updatedActions = [...actions];
    const actionIndex = updatedActions.findIndex((a) => a.id === action.id);
    if (actionIndex !== -1) {
      updatedActions[actionIndex].is_done = 1;
      setActions(updatedActions);
    }

    const nextPendingIndex = updatedActions.findIndex(
      (a, idx) => idx > currentActionIndex && !a.is_done
    );

    if (nextPendingIndex !== -1) {
      setCurrentActionIndex(nextPendingIndex);

      const nextAction = updatedActions[nextPendingIndex];
      if (nextAction?.point_x && nextAction?.point_y && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: nextAction.point_y,
          longitude: nextAction.point_x,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      }
    } else {
      const anyPending = updatedActions.some((a) => !a.is_done);
      if (!anyPending) {
        Alert.alert("🎉 Bravo !", "Toutes les actions ont été complétées.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    }
  };

  // Slider pour validation manuelle
  const SLIDER_WIDTH = Dimensions.get("window").width - 72; // Largeur du slider
  const THUMB_SIZE = 56;
  const SLIDE_THRESHOLD = SLIDER_WIDTH - THUMB_SIZE - 10;

  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleSlideComplete = () => {
    const currentAction = actions[currentActionIndex];
    if (currentAction) {
      markActionAsDone(currentAction);
    }
    setTimeout(() => {
      slideAnim.setValue(0);
    }, 300);
  };

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
          const newValue = Math.max(
            0,
            Math.min(gestureState.dx, SLIDE_THRESHOLD)
          );
          slideAnim.setValue(newValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= SLIDE_THRESHOLD) {
            // Validation réussie
            Animated.timing(slideAnim, {
              toValue: SLIDE_THRESHOLD,
              duration: 100,
              useNativeDriver: false,
            }).start(() => {
              handleSlideComplete();
            });
          } else {
            // Retour au début
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: false,
              tension: 50,
              friction: 8,
            }).start();
          }
        },
      }),
    [actions, currentActionIndex]
  );

  const getActionIcon = (type: string | null) => {
    switch (type) {
      case "pose":
        return "tool";
      case "retrait":
        return "upload";
      case "déploiement":
        return "zap";
      case "inspection":
        return "search";
      default:
        return "circle";
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "--:--";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "--:--";
      return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      });
    } catch (e) {
      console.error("Erreur format date:", e);
      return "--:--";
    }
  };

  const getDistanceToCurrentAction = () => {
    if (routeDistance !== null) {
      if (routeDistance < 1000) {
        return `${Math.round(routeDistance)} m`;
      }
      return `${(routeDistance / 1000).toFixed(1)} km`;
    }

    const currentAction = getCurrentAction();
    if (!currentAction?.point_x || !currentAction?.point_y || !userLocation) {
      return null;
    }
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      currentAction.point_y,
      currentAction.point_x
    );
    if (distance < 1000) {
      return `${Math.round(distance)} m`;
    }
    return `${(distance / 1000).toFixed(1)} km`;
  };

  const getEstimatedTime = () => {
    if (routeDuration !== null) {
      const minutes = Math.ceil(routeDuration / 60);
      if (minutes < 60) {
        return `${minutes} min`;
      }
      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;
      return `${hours}h${remainingMins > 0 ? remainingMins : ""}`;
    }
    return null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text style={styles.loadingText}>Chargement du guidage...</Text>
      </View>
    );
  }

  if (actions.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#fff" />
            <Text style={styles.backText}>Retour</Text>
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <Feather name="check-circle" size={64} color={Colors.accent} />
          <Text style={styles.emptyTitle}>Toutes les actions terminées !</Text>
          <Text style={styles.emptySubtitle}>
            Il n'y a plus d'actions en attente pour cette équipe.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentAction = getCurrentAction();
  const initialRegion: Region =
    currentAction?.point_x && currentAction?.point_y
      ? {
          latitude: currentAction.point_y,
          longitude: currentAction.point_x,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : {
          latitude: 48.5734,
          longitude: 7.7521,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };

  return (
    <View style={styles.container}>
      {/* Carte */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Marqueurs pour toutes les actions */}
        {actions.map((action, index) => {
          if (!action.point_x || !action.point_y) return null;
          const isCurrent = index === currentActionIndex;
          return (
            <Marker
              key={action.id}
              coordinate={{
                latitude: action.point_y,
                longitude: action.point_x,
              }}
              pinColor={isCurrent ? Colors.secondary : "#999"}
              title={`${index + 1}. ${getActionTypeLabel(action.type)}`}
              description={action.equipement_name || ""}
            />
          );
        })}

        {/* Ligne de guidage suivant les routes */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={Colors.secondary}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Header superposé */}
      <View style={styles.headerOverlay}>
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButtonOverlay}
          >
            <Feather name="x" size={24} color="#333" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{teamName}</Text>
            <Text style={styles.headerSubtitle}>
              Action {currentActionIndex + 1} / {actions.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Panneau d'action en bas */}
      <View style={styles.bottomPanel}>
        <View style={styles.progressBar}>
          {actions.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index < currentActionIndex && styles.progressDotDone,
                index === currentActionIndex && styles.progressDotCurrent,
              ]}
            />
          ))}
        </View>

        {currentAction && (
          <View style={styles.actionInfo}>
            <View style={styles.actionIconContainer}>
              <Feather
                name={getActionIcon(currentAction.type) as any}
                size={28}
                color={Colors.secondary}
              />
            </View>
            <View style={styles.actionDetails}>
              <Text style={styles.actionType}>
                {getActionTypeLabel(currentAction.type)}
              </Text>
              <Text style={styles.actionEquipement}>
                {currentAction.equipement_name || "Équipement"}
              </Text>
              <View style={styles.actionMeta}>
                <Feather name="clock" size={12} color={Colors.textSecondary} />
                <Text style={styles.actionTime}>
                  {formatTime(currentAction.scheduled_time)}
                </Text>
                {getDistanceToCurrentAction() && (
                  <>
                    <Text style={styles.metaSeparator}>•</Text>
                    <Feather
                      name="navigation"
                      size={12}
                      color={Colors.textSecondary}
                    />
                    <Text style={styles.actionDistance}>
                      {getDistanceToCurrentAction()}
                    </Text>
                  </>
                )}
                {getEstimatedTime() && (
                  <>
                    <Text style={styles.metaSeparator}>•</Text>
                    <Feather name="clock" size={12} color={Colors.secondary} />
                    <Text
                      style={[
                        styles.actionDistance,
                        { color: Colors.secondary },
                      ]}
                    >
                      ~{getEstimatedTime()}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Bouton Google Maps */}
        {currentAction?.point_x && currentAction?.point_y && (
          <Pressable
            style={({ pressed }) => [
              styles.googleMapsButton,
              pressed && styles.googleMapsButtonPressed,
            ]}
            onPress={() => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${currentAction.point_y},${currentAction.point_x}&travelmode=walking`;
              Linking.openURL(url);
            }}
          >
            <View style={styles.openMapsButtonContent}>
              <Feather name="map-pin" size={18} color="#4285F4" />
              <Text style={styles.googleMapsButtonText}>
                Ouvrir dans Google Maps
              </Text>
            </View>
          </Pressable>
        )}

        {/* Slider pour valider */}
        <View style={styles.sliderContainer}>
          <View style={styles.sliderTrack}>
            <Text style={styles.sliderText}>Glisser pour valider →</Text>
            <Animated.View
              style={[
                styles.sliderThumb,
                {
                  transform: [{ translateX: slideAnim }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <Feather name="chevrons-right" size={28} color={Colors.accent} />
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  map: {
    flex: 1,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  openMapsButtonContent: {
    flexDirection: "row",
    gap: 10,
  },
  backButtonOverlay: {
    padding: 4,
  },
  headerTitleContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#666",
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  progressBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E0E0E0",
  },
  progressDotDone: {
    backgroundColor: Colors.accent,
  },
  progressDotCurrent: {
    backgroundColor: Colors.secondary,
    width: 24,
  },
  actionInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
  },
  actionDetails: {
    flex: 1,
    marginLeft: 16,
  },
  actionType: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  actionEquipement: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  actionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  actionTime: {
    fontSize: 12,
    color: "#666",
  },
  metaSeparator: {
    color: "#999",
    marginHorizontal: 4,
  },
  actionDistance: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: "500",
  },
  sliderContainer: {
    marginTop: 8,
  },
  sliderTrack: {
    backgroundColor: "#FEF9C3",
    borderRadius: 30,
    height: 60,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  sliderText: {
    color: Colors.accentDark,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginLeft: 50,
  },
  sliderThumb: {
    position: "absolute",
    left: 4,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  googleMapsButton: {
    backgroundColor: "#4285F4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  googleMapsButtonPressed: {
    backgroundColor: "#3367D6",
  },
  googleMapsButtonText: {
    color: "#4285F4",
    fontSize: 15,
    fontWeight: "600",
  },
});
