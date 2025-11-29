import { View, Text, Pressable, FlatList } from "react-native";
import QRCodeScanner from "../components/QrCodeSacnner";
import { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import getDatabase from "../../assets/migrations";
import { EventType } from "../types/database";
import EventItem from "../components/EventItem";
import Feather from "@expo/vector-icons/Feather";
import { useEvent } from "../context/EventContext";

export default function ConnectEvent() {
  const [scanQR, setScanQR] = useState(false);
  const [events, setEvents] = useState<EventType[]>([]);
  const navigation = useNavigation<any>();
  const db = getDatabase();
  const { setSelectedEventId } = useEvent();

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = () => {
    try {
      const eventsList = db.getAllSync<EventType>(
        "SELECT * FROM event ORDER BY dateDebut DESC"
      );
      setEvents(eventsList);
    } catch (error) {
      console.error("Erreur chargement événements:", error);
    }
  };

  const handleEventSelect = (event: EventType) => {
    console.log("Événement sélectionné:", event);
    setSelectedEventId(event.id);
    navigation.navigate("Tabs");
  };

  if (scanQR) {
    return (
      <View className="container">
        <View className="header header-row">
          <Pressable onPress={() => setScanQR(false)} className="row gap-2">
            <Feather name="arrow-left" size={24} color="#fff" />
            <Text className="text-white text-lg font-semibold">Retour</Text>
          </Pressable>
        </View>
        <QRCodeScanner setScanQR={setScanQR} />
      </View>
    );
  }

  return (
    <View className="container">
      <View className="header">
        <Text className="header-title">Sélectionner un événement</Text>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <EventItem event={item} onPress={handleEventSelect} />
        )}
        contentContainerClassName="py-4 flex-grow"
        ListEmptyComponent={
          <View className="center py-16">
            <Text className="text-base text-gray-400 mt-4">
              Aucun événement disponible
            </Text>
          </View>
        }
      />

      <Pressable
        className="absolute bottom-6 left-6 right-6 bg-blue-500 flex-row items-center justify-center gap-3 py-4 rounded-xl shadow-lg active:bg-blue-600"
        onPress={() => setScanQR(true)}
      >
        <Feather name="camera" size={24} color="#fff" />
        <Text className="text-lg font-semibold text-white">
          Scanner un QR Code
        </Text>
      </Pressable>
    </View>
  );
}
