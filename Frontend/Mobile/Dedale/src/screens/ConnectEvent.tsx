import { View, Text, Pressable, FlatList } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import QRCodeScanner from "../components/QrCodeScanner";
import { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import EventItem from "../components/EventItem";
import { Feather } from "@expo/vector-icons";
import { useEvent, EventWithStatus } from "../context/EventContext";
import { EventType } from "../types/database";

// Fonction utilitaire exportée pour les tests
export function sortEventsByStatus(events: (EventType | EventWithStatus)[]): (EventType | EventWithStatus)[] {
  const statusPriority: Record<string, number> = {
    'actif': 0,
    'planifié': 1,
    'passé': 2,
  };
  
  return [...events].sort((a, b) => {
    // Support both 'status' and 'statut' properties
    const statusA = ((a as any).status || (a as any).statut || '').toLowerCase();
    const statusB = ((b as any).status || (b as any).statut || '').toLowerCase();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEventSelect = (event: EventType | EventWithStatus) => {
    console.log("Événement sélectionné:", event);
    setSelectedEventId(event.id);
    navigation.navigate("Tabs");
  };

  if (scanQR) {
    return (
      <SafeAreaView className="container" edges={["top"]}>
        <View className="header header-row">
          <Pressable onPress={() => setScanQR(false)} className="row gap-2">
            <Feather name="arrow-left" size={24} color="#fff" />
            <Text className="text-white text-lg font-semibold">Retour</Text>
          </Pressable>
        </View>
        <QRCodeScanner setScanQR={setScanQR} />
      </SafeAreaView>
    );
  }

  return (
    <View className="container">
      <SafeAreaView edges={["top"]} className="bg-blue-500">
        <View className="bg-blue-500 pb-4 px-4">
          <Text className="header-title">Sélectionner un événement</Text>
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
          <View className="center py-16">
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
          className="bg-blue-500 flex-row items-center justify-center gap-3 py-4 rounded-xl shadow-lg active:bg-blue-600"
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
