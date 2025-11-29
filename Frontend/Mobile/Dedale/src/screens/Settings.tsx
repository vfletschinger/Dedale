import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
} from "react-native";
import CustomButton from "../components/CustomButton";
import QRCodeScanner from "../components/QrCodeScanner";
import Feather from "@expo/vector-icons/Feather";
import { useEvent } from "../context/EventContext";
import { useNavigation } from "@react-navigation/native";
import getDatabase from "../../assets/migrations";
import { EventType } from "../types/database";
import EventItem from "../components/EventItem";

export default function SettingsScreen() {
  const [scanQR, setScanQR] = useState(false);
  const [isEventListExpanded, setIsEventListExpanded] = useState(false);
  const { selectedEventId, setSelectedEventId } = useEvent();
  const [events, setEvents] = useState<EventType[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const db = getDatabase();
  const navigation = useNavigation<any>();

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      const event = events.find((e) => e.id === selectedEventId);
      setSelectedEvent(event || null);
    }
  }, [selectedEventId, events]);

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

  const handleEventChange = (event: EventType) => {
    setSelectedEventId(event.id);
    setSelectedEvent(event);
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
            <Text className="text-sm text-gray-600 text-center mb-6">
              Scan QR code to sync data
            </Text>
            <CustomButton
              onPress={() => setScanQR(true)}
              title="Scan QR Code"
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
