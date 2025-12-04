import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  Alert,
} from "react-native";
import CustomButton from "../components/CustomButton";
import QRCodeScanner from "../components/QrCodeScanner";
import { Feather } from "@expo/vector-icons";
import { useEvent, EventWithStatus } from "../context/EventContext";
import { useWebSocket } from "../context/WebSocketContext";
import { getDatabase } from "../../assets/migrations";
import {
  InterestPointsType,
  CommentType,
  PictureType,
  ObstacleType,
} from "../types/database";
import EventItem from "../components/EventItem";
import { WebSocketResponse } from "../components/WebSocketClient";

// Type pour l'export complet d'un événement avec ses données liées
type PointWithDetails = InterestPointsType & {
  comments: CommentType[];
  pictures: PictureType[];
  obstacles: ObstacleType[];
};

type EventExportData = {
  event: EventWithStatus;
  points: PointWithDetails[];
};

export default function SettingsScreen() {
  const [scanQR, setScanQR] = useState(false);
  const [isEventListExpanded, setIsEventListExpanded] = useState(false);
  const {
    selectedEventId,
    setSelectedEventId,
    events,
    refreshEvents,
    getSelectedEvent,
  } = useEvent();
  const { isConnected, sendEvent } = useWebSocket();
  const db = getDatabase();

  const selectedEvent = getSelectedEvent();

  const handleEventChange = (event: EventWithStatus) => {
    setSelectedEventId(event.id);
  };

  const deleteEventLocally = (eventId: number) => {
    try {
      // Récupérer tous les points liés à cet événement
      const pointIds = db.getAllSync<{ point_id: number }>(
        "SELECT point_id FROM point_event WHERE event_id = ?",
        [eventId]
      );

      // Pour chaque point, supprimer ses données associées
      for (const { point_id } of pointIds) {
        // Vérifier si le point n'est pas lié à d'autres événements
        const otherLinks = db.getFirstSync<{ count: number }>(
          "SELECT COUNT(*) as count FROM point_event WHERE point_id = ? AND event_id != ?",
          [point_id, eventId]
        );

        // Si le point n'est lié à aucun autre événement, supprimer ses données
        if (!otherLinks || otherLinks.count === 0) {
          db.runSync("DELETE FROM comment WHERE point_id = ?", [point_id]);
          db.runSync("DELETE FROM picture WHERE point_id = ?", [point_id]);
          db.runSync("DELETE FROM obstacle WHERE point_id = ?", [point_id]);
          db.runSync("DELETE FROM point WHERE id = ?", [point_id]);
        }
      }

      // Supprimer les géométries liées à l'événement
      db.runSync("DELETE FROM geometry WHERE event_id = ?", [eventId]);

      // Delete the many-to-many relationship (point_event)
      db.runSync("DELETE FROM point_event WHERE event_id = ?", [eventId]);

      // Delete the event itself
      db.runSync("DELETE FROM event WHERE id = ?", [eventId]);

      console.log(
        `✅ Événement ${eventId} et ses données liées supprimés localement`
      );

      // Rafraîchir la liste des événements via le contexte
      refreshEvents();

      // Clear selection if the deleted event was selected
      if (selectedEventId === eventId) {
        setSelectedEventId(null);
      }
    } catch (error) {
      console.error("❌ Erreur lors de la suppression de l'événement:", error);
      Alert.alert("Erreur", "Impossible de supprimer l'événement localement");
    }
  };

  const getEventExportData = (eventId: number): EventExportData | null => {
    try {
      // Utiliser l'événement du contexte (déjà avec le statut calculé)
      const event = events.find((e) => e.id === eventId);
      if (!event) return null;

      // Récupérer les points liés à l'événement
      const points = db.getAllSync<InterestPointsType>(
        `SELECT p.id, p.x, p.y, pe.event_id 
         FROM point p 
         INNER JOIN point_event pe ON p.id = pe.point_id 
         WHERE pe.event_id = ?`,
        [eventId]
      );

      // Pour chaque point, récupérer ses commentaires, photos et obstacles
      const pointsWithDetails: PointWithDetails[] = points.map((point) => {
        const comments = db.getAllSync<CommentType>(
          "SELECT * FROM comment WHERE point_id = ?",
          [point.id]
        );
        const pictures = db.getAllSync<PictureType>(
          "SELECT * FROM picture WHERE point_id = ?",
          [point.id]
        );
        const obstacles = db.getAllSync<ObstacleType>(
          "SELECT * FROM obstacle WHERE point_id = ?",
          [point.id]
        );

        return {
          ...point,
          comments,
          pictures,
          obstacles,
        };
      });

      return {
        event,
        points: pointsWithDetails,
      };
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données d'export:",
        error
      );
      return null;
    }
  };

  const handleExportEvent = () => {
    // Vérifier qu'un événement est sélectionné
    if (!selectedEvent) {
      Alert.alert(
        "Aucun événement sélectionné",
        "Veuillez sélectionner un événement à exporter.",
        [{ text: "OK" }]
      );
      return;
    }

    // Vérifier la connexion
    if (!isConnected) {
      Alert.alert(
        "Non connecté",
        "Vous n'êtes pas connecté à l'application de bureau. Scannez le QR code pour vous connecter.",
        [{ text: "OK" }]
      );
      return;
    }

    // Récupérer toutes les données liées à l'événement
    const exportData = getEventExportData(selectedEvent.id);

    if (!exportData) {
      Alert.alert(
        "Erreur de récupération",
        "Impossible de récupérer les données de l'événement. Veuillez réessayer.",
        [{ text: "OK" }]
      );
      return;
    }

    console.log("📤 Export événement avec données complètes:", {
      event: exportData.event.name,
      pointsCount: exportData.points.length,
    });

    // Envoyer avec gestion d'erreur
    const sent = sendEvent(
      exportData,
      (response: WebSocketResponse) => {
        switch (response.code) {
          case 1:
            // Desktop refuses the import
            Alert.alert(
              "Import refusé",
              response.message ||
                "Le serveur a refusé l'import de l'événement.",
              [{ text: "OK" }]
            );
            break;

          case 2:
            // Desktop accepts but fails to import
            Alert.alert(
              "Échec de l'import",
              response.message ||
                "Le serveur a accepté mais n'a pas pu importer l'événement.",
              [{ text: "OK" }]
            );
            break;

          case 3:
            // Desktop accepts and successfully imports
            Alert.alert(
              "Export réussi",
              response.message ||
                "L'événement a été exporté avec succès. Il sera supprimé de votre appareil.",
              [
                {
                  text: "OK",
                  onPress: () => deleteEventLocally(selectedEvent.id),
                },
              ]
            );
            break;

          default:
            // Code de réponse inconnu
            Alert.alert(
              "Réponse inattendue",
              `Le serveur a renvoyé un code inconnu: ${response.code}`,
              [{ text: "OK" }]
            );
            break;
        }
      },
      (error: string) => {
        // Callback d'erreur d'envoi
        Alert.alert(
          "Erreur d'envoi",
          `Impossible d'envoyer les données: ${error}`,
          [{ text: "OK" }]
        );
      }
    );

    if (!sent) {
      // L'envoi a échoué immédiatement (le callback onError a déjà été appelé)
      console.log("❌ Échec de l'envoi de l'événement");
    }
  };

  return (
    <SafeAreaView className="container">
      <View className="header header-row">
        {scanQR && (
          <TouchableOpacity onPress={() => setScanQR(false)} className="mr-4">
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
        )}
        <View className="flex-row items-center flex-1">
          <Text className="header-title">Settings</Text>
        </View>
      </View>

      {scanQR ? (
        <QRCodeScanner setScanQR={setScanQR} />
      ) : (
        <View className="flex-1 p-5">
          {/* Section Événement actuel */}
          <View style={isEventListExpanded ? { flex: 0.25 } : { flex: 0.33 }}>
            <Text className="text-section-title mb-3">Événement actuel</Text>
            {selectedEvent ? (
              <EventItem
                event={selectedEvent}
                onPress={() => {}}
                navArrow={false}
              />
            ) : (
              <Text className="text-caption">Aucun événement sélectionné</Text>
            )}
          </View>

          {/* Section Changer d'événement - dynamique */}
          <View
            className="section-box"
            style={
              isEventListExpanded
                ? { flex: 1, maxHeight: "50%" }
                : { flex: 0.05, justifyContent: "center" }
            }
          >
            <Pressable
              onPress={() => setIsEventListExpanded(!isEventListExpanded)}
              className="section-header"
            >
              <Text className="text-section-title">Événements disponibles</Text>
              <Feather
                name={isEventListExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color="#374151"
              />
            </Pressable>
            {isEventListExpanded && events.length > 0 ? (
              <FlatList
                data={events}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      handleEventChange(item);
                      setIsEventListExpanded(false);
                    }}
                    className={
                      item.id === selectedEventId
                        ? "modal-select-item-active"
                        : "modal-select-item"
                    }
                  >
                    <View className="flex-1">
                      <Text className="font-semibold">{item.name}</Text>
                      <Text className="text-xs text-gray-500" numberOfLines={1}>
                        {item.description}
                      </Text>
                    </View>
                    {item.id === selectedEventId && (
                      <View className="modal-checkbox">
                        <Text>✓</Text>
                      </View>
                    )}
                  </Pressable>
                )}
              />
            ) : isEventListExpanded && events.length === 0 ? (
              <Text className="text-caption">Aucun événement disponible</Text>
            ) : null}
          </View>

          {/* Section Synchronisation */}
          <View
            className="items-center justify-center"
            style={isEventListExpanded ? { flex: 0.25 } : { flex: 0.33 }}
          >
            <Feather name="settings" size={48} color="#3b82f6" />
            <Text className="text-lg font-bold text-gray-800 mt-3 mb-2 text-center">
              Data Synchronization
            </Text>

            {!isConnected ? (
              <>
                <Text className="text-sm text-gray-600 text-center mb-6">
                  Scan QR code to connect desktop application
                </Text>
                <CustomButton
                  onPress={() => setScanQR(true)}
                  title="Scan QR Code"
                />
              </>
            ) : (
              <>
                <Text className="text-sm text-green-600 text-center mb-6">
                  ✓ Connecté à l&apos;application de bureau
                </Text>
                <CustomButton
                  onPress={handleExportEvent}
                  title="Exporter l'événement vers l'application de bureau"
                  disabled={!selectedEvent}
                />
              </>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
