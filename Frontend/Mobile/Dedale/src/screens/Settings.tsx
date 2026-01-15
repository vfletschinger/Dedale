import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  Alert,
} from "react-native";
import CustomButton from "../components/CustomButton";
import QRCodeScanner from "../components/QrCodeScanner";
import Feather from "@expo/vector-icons/Feather";
import { useEvent, EventWithStatus } from "../context/EventContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useNavigation } from "@react-navigation/native";
import getDatabase from "../../assets/migrations";
import EventItem from "../components/EventItem";
import {
  InterestPointsType,
  PictureType,
  EquipementType,
} from "../types/database";
import Colors from "../constants/colors";

type PointWithDetails = InterestPointsType & {
  pictures: PictureType[];
  equipements: EquipementType[];
};

type EventExportData = {
  event: any;
  points: PointWithDetails[];
  equipements: EquipementType[];
};

export default function SettingsScreen() {
  const [scanQR, setScanQR] = useState(false);
  const [scanMode, setScanMode] = useState<"receive" | "send">("receive");
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
  const navigation = useNavigation<any>();

  const selectedEvent = getSelectedEvent();

  const handleEventChange = (event: EventWithStatus) => {
    setSelectedEventId(event.id);
  };

  const deleteEventLocally = (eventId: string) => {
    try {
      // Supprimer les parcours et zones liés à l'événement
      db.runSync("DELETE FROM parcours WHERE event_id = ?", [eventId]);
      db.runSync("DELETE FROM zone WHERE event_id = ?", [eventId]);

      // Les points, équipements et pictures seront supprimés par CASCADE
      db.runSync("DELETE FROM point WHERE event_id = ?", [eventId]);

      // Supprimer l'événement lui-même
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

  const getEventExportData = (eventId: string): EventExportData | null => {
    try {
      // Utiliser l'événement du contexte (déjà avec le statut calculé)
      const event = events.find((e) => e.id === eventId);
      if (!event) return null;

      // Récupérer les points liés à l'événement
      const points = db.getAllSync<InterestPointsType>(
        `SELECT p.* FROM point p WHERE p.event_id = ?`,
        [eventId]
      );

      // Pour chaque point, récupérer ses photos
      const pointsWithDetails: PointWithDetails[] = points.map((point) => {
        const pictures = db.getAllSync<PictureType>(
          "SELECT * FROM picture WHERE point_id = ?",
          [point.id]
        );

        return {
          ...point,
          pictures,
          equipements: [], // Les équipements sont maintenant au niveau event
        };
      });

      // Récupérer les équipements de l'événement avec leurs coordonnées
      const equipements = db.getAllSync<EquipementType>(
        `SELECT e.*, t.name, t.description 
         FROM equipement e 
         LEFT JOIN type t ON e.type_id = t.id 
         WHERE e.event_id = ?`,
        [eventId]
      );

      return {
        event,
        points: pointsWithDetails,
        equipements: equipements || [],
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
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4 shadow-sm flex-row items-center justify-between">
        {scanQR && (
          <TouchableOpacity onPress={() => setScanQR(false)} className="mr-4">
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
        )}
        <View className="flex-row items-center flex-1">
          <Text className="text-accent text-2xl font-bold">Settings</Text>
        </View>
      </View>

      {scanQR ? (
        <QRCodeScanner
          setScanQR={setScanQR}
          mode={scanMode}
          eventToSend={scanMode === "send" ? selectedEvent : undefined}
          onExportSuccess={() => {
            if (selectedEvent) {
              deleteEventLocally(selectedEvent.id);
            }
            setScanQR(false);
            setScanMode("receive");
          }}
        />
      ) : (
        <View className="flex-1 p-5">
          {/* Section Événement actuel */}
          <View style={isEventListExpanded ? { flex: 0.25 } : { flex: 0.33 }}>
            <Text className="text-lg font-semibold mb-3">Événement actuel</Text>
            {selectedEvent ? (
              <EventItem
                event={selectedEvent}
                onPress={() => {}}
                navArrow={false}
              />
            ) : (
              <Text className="text-sm text-gray-500">
                Aucun événement sélectionné
              </Text>
            )}
          </View>

          {/* Section Changer d'événement - dynamique */}
          <View
            className="bg-gray-100 p-4 rounded-lg mb-4"
            style={
              isEventListExpanded
                ? { flex: 1, maxHeight: "50%" }
                : { flex: 0.05, justifyContent: "center" }
            }
          >
            <Pressable
              onPress={() => setIsEventListExpanded(!isEventListExpanded)}
              className="flex-row justify-between items-center mb-2"
            >
              <Text className="text-lg font-semibold">
                Événements disponibles
              </Text>
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
                        ? "flex-row items-center justify-between p-3 rounded-lg mb-2 bg-blue-50"
                        : "flex-row items-center justify-between p-3 rounded-lg mb-2 bg-white"
                    }
                  >
                    <View className="flex-1">
                      <Text className="font-semibold">{item.name}</Text>
                      <Text className="text-xs text-gray-500" numberOfLines={1}>
                        {item.description}
                      </Text>
                    </View>
                    {item.id === selectedEventId && (
                      <View className="w-8 h-8 rounded-full items-center justify-center border border-gray-300">
                        <Text>✓</Text>
                      </View>
                    )}
                  </Pressable>
                )}
              />
            ) : isEventListExpanded && events.length === 0 ? (
              <Text className="text-sm text-gray-500">
                Aucun événement disponible
              </Text>
            ) : null}
          </View>

          {/* Section Synchronisation */}
          <View
            className="items-center justify-center"
            style={isEventListExpanded ? { flex: 0.25 } : { flex: 0.33 }}
          >
            <Feather name="settings" size={48} color={Colors.secondary} />
            <Text className="text-lg font-bold text-gray-800 mt-3 mb-2 text-center">
              Data Synchronization
            </Text>

            <Text className="text-sm text-gray-600 text-center mb-4">
              Scannez un QR code pour recevoir ou envoyer des données
            </Text>

            <View className="w-full gap-3">
              {/* Bouton pour recevoir (scan QR du desktop) */}
              <CustomButton
                onPress={() => {
                  setScanMode("receive");
                  setScanQR(true);
                }}
                title="📥 Recevoir des événements"
              />

              {/* Bouton pour envoyer (scan QR du desktop) */}
              <CustomButton
                onPress={() => {
                  if (!selectedEvent) {
                    Alert.alert(
                      "Aucun événement sélectionné",
                      "Veuillez sélectionner un événement à exporter."
                    );
                    return;
                  }
                  setScanMode("send");
                  setScanQR(true);
                }}
                title="📤 Envoyer l'événement au bureau"
                disabled={!selectedEvent}
              />
            </View>

            {isConnected && (
              <Text className="text-sm text-green-600 text-center mt-4">
                ✓ Connecté à l'application de bureau
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
