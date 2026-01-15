import { View, Text, Pressable, FlatList } from "react-native";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import QRCodeScanner from "../components/QrCodeScanner";
import { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import EventItem from "../components/EventItem";
import { Feather } from "@expo/vector-icons";
import { useEvent, EventWithStatus } from "../context/EventContext";
import { EventType } from "../types/database";
import { getDatabase } from "../../assets/migrations";

export function sortEventsByStatus(
  events: (EventType | EventWithStatus)[]
): (EventType | EventWithStatus)[] {
  const statusPriority: Record<string, number> = {
    actif: 0,
    planifié: 1,
    passé: 2,
  };

  return [...events].sort((a, b) => {
    const statusA = (
      (a as any).status ||
      (a as any).statut ||
      ""
    ).toLowerCase();
    const statusB = (
      (b as any).status ||
      (b as any).statut ||
      ""
    ).toLowerCase();
    const priorityA = statusPriority[statusA] ?? 999;
    const priorityB = statusPriority[statusB] ?? 999;
    return priorityA - priorityB;
  });
}

export default function ConnectEvent() {
  const [scanQR, setScanQR] = useState(false);
  const navigation = useNavigation<any>();
  const { events, refreshEvents, setSelectedEventId } = useEvent();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    refreshEvents();
  }, []);

  const handleEventSelect = (event: EventType | EventWithStatus) => {
    const db = getDatabase();

    const pointCount = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM point WHERE event_id = ?",
      [event.id]
    );
    const parcoursCount = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM parcours WHERE event_id = ?",
      [event.id]
    );
    const zoneCount = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM zone WHERE event_id = ?",
      [event.id]
    );
    const teamCount = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM team WHERE event_id = ?",
      [event.id]
    );
    const pictureCount = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM picture p 
       INNER JOIN point pt ON p.point_id = pt.id 
       WHERE pt.event_id = ?`,
      [event.id]
    );
    const equipementCount = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM equipement e 
       WHERE e.event_id = ?`,
      [event.id]
    );

    console.log("=== ÉVÉNEMENT CHARGÉ ===");
    console.log("ID:", event.id);
    console.log("Nom:", event.name);
    console.log("Description:", event.description);
    console.log("Date de début:", event.dateDebut);
    console.log("Date de fin:", event.dateFin);
    console.log("Statut:", event.statut);
    const calculatedStatus = (event as EventWithStatus).calculatedStatus;
    if (calculatedStatus) {
      console.log("Statut calculé:", calculatedStatus);
    }
    console.log("--- STATISTIQUES ---");
    console.log("Points d'intérêt:", pointCount?.count ?? 0);
    console.log("Parcours:", parcoursCount?.count ?? 0);
    console.log("Zones:", zoneCount?.count ?? 0);
    console.log("Équipes:", teamCount?.count ?? 0);
    console.log("Photos:", pictureCount?.count ?? 0);
    console.log("Équipements:", equipementCount?.count ?? 0);
    console.log("actions:", (event as any).actionCount ?? 0);
    console.log("--- DONNÉES COMPLÈTES ---");
    console.log(JSON.stringify(event, null, 2));
    console.log("========================");

    setSelectedEventId(event.id);
    navigation.navigate("Tabs");
  };

  if (scanQR) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="bg-primary pt-4 pb-4 px-4 shadow-sm flex-row items-center justify-between">
          <Pressable
            onPress={() => setScanQR(false)}
            className="flex-row items-center gap-2"
          >
            <Feather name="arrow-left" size={24} color="#fff" />
            <Text className="text-white text-lg font-semibold">Retour</Text>
          </Pressable>
        </View>
        <QRCodeScanner setScanQR={setScanQR} />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView edges={["top"]} className="bg-primary">
        <View className="bg-primary pb-4 px-4">
          <Text className="text-accent text-2xl font-bold">
            Sélectionner un événement
          </Text>
        </View>
      </SafeAreaView>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <EventItem event={item} onPress={handleEventSelect} />
        )}
        contentContainerClassName="py-4 flex-grow"
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-16">
            <Text className="text-base text-gray-400 mt-4">
              Aucun événement disponible
            </Text>
          </View>
        }
      />

      <View
        className="absolute bottom-0 left-0 right-0 px-4 pt-4 bg-gray-50"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <Pressable
          className="bg-secondary flex-row items-center justify-center gap-3 py-4 rounded-xl shadow-lg active:bg-secondary-dark"
          onPress={() => setScanQR(true)}
        >
          <Feather name="camera" size={24} color="#fff" />
          <Text className="text-lg font-semibold text-white">
            Scanner un QR Code
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
