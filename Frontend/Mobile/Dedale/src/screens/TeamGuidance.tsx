import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import * as Location from "expo-location";
import { getDatabase } from "../../assets/migrations";

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
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const lastRouteUpdate = useRef<number>(0);

  useEffect(() => {
    loadActionsAndLocation();
  }, [teamId]);

  // Charger l'itinéraire quand la position ou l'action change (avec throttle)
  useEffect(() => {
    const currentAction = actions[currentActionIndex];
    if (userLocation && currentAction?.point_x && currentAction?.point_y) {
      const now = Date.now();
      // Ne pas mettre à jour la route plus d'une fois toutes les 10 secondes
      // sauf si l'action a changé
      if (now - lastRouteUpdate.current > 10000 || routeCoordinates.length === 0) {
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

  // Recalculer la route immédiatement quand l'action change
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

  // Fonction pour récupérer l'itinéraire via OSRM
  const fetchRoute = async (
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number
  ) => {
    try {
      // OSRM API - utilise le mode "foot" pour la marche
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
        setRouteDistance(route.distance); // en mètres
        setRouteDuration(route.duration); // en secondes
        console.log("🗺️ Route chargée:", coordinates.length, "points,", route.distance, "m");
      } else {
        console.log("⚠️ Pas de route trouvée, utilisation ligne directe");
        // Fallback: ligne directe
        setRouteCoordinates([
          { latitude: startLat, longitude: startLng },
          { latitude: endLat, longitude: endLng },
        ]);
        setRouteDistance(null);
        setRouteDuration(null);
      }
    } catch (error) {
      console.error("Erreur récupération itinéraire:", error);
      // Fallback: ligne directe
      setRouteCoordinates([
        { latitude: startLat, longitude: startLng },
        { latitude: endLat, longitude: endLng },
      ]);
    }
  };

  const loadActionsAndLocation = async () => {
    try {
      const db = getDatabase();
      
      // Récupérer l'event_id via team
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
      
      // Charger tous les points de l'événement
      const eventPoints = db.getAllSync<{ id: string; x: number; y: number; name: string }>(
        "SELECT id, x, y, name FROM point WHERE event_id = ?",
        [team.event_id]
      );
      console.log("📍 Points de l'event:", eventPoints?.length || 0);
      if (eventPoints && eventPoints.length > 0) {
        console.log("📍 Premier point:", JSON.stringify(eventPoints[0]));
      }
      
      // Charger les actions de l'équipe (toutes, pas seulement non terminées pour affichage)
      const actionsResult = db.getAllSync<ActionWithPoint>(
        `SELECT a.*, 
                et.name as equipement_name
         FROM action a 
         LEFT JOIN equipement e ON a.equipement_id = e.id
         LEFT JOIN equipement_type et ON e.type_id = et.id
         WHERE a.team_id = ?
         ORDER BY a.scheduled_time ASC`,
        [teamId]
      );
      
      console.log("📍 Actions chargées:", actionsResult?.length || 0);
      if (actionsResult && actionsResult.length > 0) {
        console.log("📍 Première action:", JSON.stringify(actionsResult[0]));
      }
      
      // Associer chaque action à un point (distribution cyclique)
      if (actionsResult && actionsResult.length > 0 && eventPoints && eventPoints.length > 0) {
        const actionsWithPoints = actionsResult.map((action, index) => ({
          ...action,
          point_x: eventPoints[index % eventPoints.length].x,
          point_y: eventPoints[index % eventPoints.length].y,
          point_name: eventPoints[index % eventPoints.length].name || `Point ${index + 1}`,
        }));
        console.log("📍 Actions avec points:", JSON.stringify(actionsWithPoints[0]));
        console.log("📍 Coordonnées action 0: x=", actionsWithPoints[0].point_x, "y=", actionsWithPoints[0].point_y);
        setActions(actionsWithPoints);
        
        // Trouver la première action non terminée
        const firstPendingIndex = actionsWithPoints.findIndex(a => !a.is_done);
        setCurrentActionIndex(firstPendingIndex >= 0 ? firstPendingIndex : 0);
      } else if (actionsResult && actionsResult.length > 0) {
        // Pas de points, utiliser des coordonnées par défaut (Strasbourg)
        console.log("⚠️ Pas de points, utilisation de coordonnées par défaut");
        const actionsWithDefaultPoints = actionsResult.map((action, index) => ({
          ...action,
          point_x: 7.7521 + (index * 0.001),
          point_y: 48.5734 + (index * 0.001),
          point_name: `Action ${index + 1}`,
        }));
        setActions(actionsWithDefaultPoints);
        const firstPendingIndex = actionsWithDefaultPoints.findIndex(a => !a.is_done);
        setCurrentActionIndex(firstPendingIndex >= 0 ? firstPendingIndex : 0);
      } else {
        setActions([]);
      }

      // Demander la permission de localisation
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Suivre la position en temps réel
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

  const validateCurrentAction = () => {
    const currentAction = getCurrentAction();
    if (!currentAction) return;

    Alert.alert(
      "Valider l'action",
      `Confirmer que l'action "${getActionTypeLabel(currentAction.type)}" est terminée ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Valider",
          onPress: () => {
            // Mettre à jour en base
            const db = getDatabase();
            db.runSync("UPDATE action SET is_done = 1 WHERE id = ?", [
              currentAction.id,
            ]);

            // Passer à l'action suivante
            if (currentActionIndex < actions.length - 1) {
              setCurrentActionIndex(currentActionIndex + 1);
              // Recharger les actions pour avoir l'état mis à jour
              const updatedActions = [...actions];
              updatedActions[currentActionIndex].is_done = 1;
              setActions(updatedActions);
              
              // Centrer sur le prochain point
              const nextAction = actions[currentActionIndex + 1];
              if (nextAction?.point_x && nextAction?.point_y && mapRef.current) {
                mapRef.current.animateToRegion({
                  latitude: nextAction.point_y,
                  longitude: nextAction.point_x,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                });
              }
            } else {
              // Toutes les actions sont terminées
              Alert.alert(
                "Bravo !",
                "Toutes les actions ont été complétées.",
                [{ text: "OK", onPress: () => navigation.goBack() }]
              );
            }
          },
        },
      ]
    );
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
      // Vérifier si la date est valide
      if (isNaN(date.getTime())) return "--:--";
      // Ajouter le décalage horaire local pour l'affichage
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

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const getDistanceToCurrentAction = () => {
    // Utiliser la distance de l'itinéraire si disponible
    if (routeDistance !== null) {
      if (routeDistance < 1000) {
        return `${Math.round(routeDistance)} m`;
      }
      return `${(routeDistance / 1000).toFixed(1)} km`;
    }
    
    // Fallback: calcul à vol d'oiseau
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
        <ActivityIndicator size="large" color="#007AFF" />
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
          <Feather name="check-circle" size={64} color="#34C759" />
          <Text style={styles.emptyTitle}>Toutes les actions terminées !</Text>
          <Text style={styles.emptySubtitle}>
            Il n'y a plus d'actions en attente pour cette équipe.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentAction = getCurrentAction();
  const initialRegion: Region = currentAction?.point_x && currentAction?.point_y
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
              pinColor={isCurrent ? "#007AFF" : "#999"}
              title={`${index + 1}. ${getActionTypeLabel(action.type)}`}
              description={action.equipement_name || ""}
            />
          );
        })}

        {/* Ligne de guidage suivant les routes */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#007AFF"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Header superposé */}
      <SafeAreaView style={styles.headerOverlay} edges={["top"]}>
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
      </SafeAreaView>

      {/* Panneau d'action en bas */}
      <SafeAreaView style={styles.bottomPanel} edges={["bottom"]}>
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
                color="#007AFF"
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
                <Feather name="clock" size={12} color="#666" />
                <Text style={styles.actionTime}>
                  {formatTime(currentAction.scheduled_time)}
                </Text>
                {getDistanceToCurrentAction() && (
                  <>
                    <Text style={styles.metaSeparator}>•</Text>
                    <Feather name="navigation" size={12} color="#666" />
                    <Text style={styles.actionDistance}>
                      {getDistanceToCurrentAction()}
                    </Text>
                  </>
                )}
                {getEstimatedTime() && (
                  <>
                    <Text style={styles.metaSeparator}>•</Text>
                    <Feather name="clock" size={12} color="#007AFF" />
                    <Text style={[styles.actionDistance, { color: "#007AFF" }]}>
                      ~{getEstimatedTime()}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.validateButton,
            pressed && styles.validateButtonPressed,
          ]}
          onPress={validateCurrentAction}
        >
          <Feather name="check" size={24} color="#fff" />
          <Text style={styles.validateButtonText}>Valider l'action</Text>
        </Pressable>
      </SafeAreaView>
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
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backText: {
    color: "#fff",
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
    backgroundColor: "#34C759",
  },
  progressDotCurrent: {
    backgroundColor: "#007AFF",
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
    color: "#007AFF",
    fontWeight: "500",
  },
  validateButton: {
    backgroundColor: "#34C759",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  validateButtonPressed: {
    backgroundColor: "#2DB84D",
  },
  validateButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
