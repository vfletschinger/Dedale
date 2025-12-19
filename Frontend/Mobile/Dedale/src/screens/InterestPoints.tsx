import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Modal,
  Alert,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { InterestPointsType } from "../types/database";
import { getDatabase } from "../../assets/migrations";

import {
  calculateDistance,
  getAddressFromCoords,
  getUserLocation,
  shortId,
} from "../services/Helper";
import { deletePoint } from "../services/databaseAcces";
import InterestPointCard from "../components/PointCard";
import { useEvent } from "../context/EventContext";
import { usePoints } from "../context/PointsContext";

function ModalPointItem({
  item,
  selected,
  onToggle,
}: {
  item: InterestPointsType;
  selected: boolean;
  onToggle: () => void;
}) {
  const [address, setAddress] = useState<string>("Chargement...");

  useEffect(() => {
    const fetchAddress = async () => {
      const addr = await getAddressFromCoords(item.y, item.x);
      setAddress(addr || "Adresse inconnue");
    };
    fetchAddress();
  }, [item.x, item.y]);

  return (
    <Pressable
      onPress={onToggle}
      className={selected ? "modal-select-item-active" : "modal-select-item"}
    >
      <View className="flex-1 mr-2">
        <Text className="font-medium">Point #{shortId(item.id)}</Text>
        <Text className="text-xs text-gray-500" numberOfLines={2}>
          {address}
        </Text>
      </View>
      <View className="modal-checkbox">
        <Text>{selected ? "✓" : ""}</Text>
      </View>
    </Pressable>
  );
}

export default function InterestPointsScreen() {
  const navigation = useNavigation<any>();
  const [listPoint, setListPoint] = useState<InterestPointsType[]>([]);
  const [sortedList, setSortedList] = useState<InterestPointsType[]>([]);
  const [sortBy, setSortBy] = useState<"recent" | "distance">("recent");
  const db = getDatabase();
  const { selectedEventId } = useEvent();
  const { pointsByEvent, loading: pointsLoading, refreshPoints } = usePoints();

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (selectedEventId && pointsByEvent[selectedEventId]) {
      setListPoint(pointsByEvent[selectedEventId]);
    } else {
      setListPoint([]);
    }
  }, [selectedEventId, pointsByEvent]);

  const fetchLocation = async () => {
    try {
      const userLocation = await getUserLocation();
      setLocation(userLocation);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de la localisation:",
        error
      );
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchLocation();
    }, [])
  );

  const handleDelete = (pointId: string) => {
    Alert.alert(
      "Confirmer la suppression",
      "Êtes-vous sûr de vouloir supprimer ce point ? Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            const success = deletePoint(pointId, db);
            if (success) {
              refreshPoints(); // Rafraîchir la liste des points
              Alert.alert("Succès", "Point supprimé avec succès.");
            } else {
              Alert.alert("Erreur", "Impossible de supprimer le point");
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    let sorted = [...listPoint];
    if (sortBy === "recent") {
      sorted.sort((a, b) => b.id.localeCompare(a.id));
    } else if (sortBy === "distance" && location) {
      sorted.sort((a, b) => {
        const distA = calculateDistance(
          location.longitude,
          location.latitude,
          a.x,
          a.y
        );
        const distB = calculateDistance(
          location.longitude,
          location.latitude,
          b.x,
          b.y
        );
        return distA - distB;
      });
    }
    setSortedList(sorted);
  }, [listPoint, sortBy, location]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((v) => v !== id);
      return [...prev, id];
    });
  };

  const openSelectionModal = () => {
    setSelectedIds([]);
    setModalVisible(true);
  };

  const validateSelection = () => {
    if (selectedIds.length === 0) {
      Alert.alert(
        "Aucun point sélectionné",
        "Veuillez sélectionner au moins un point pour créer un itinéraire."
      );
      return;
    }
    const selectedPoints = sortedList.filter((p) => selectedIds.includes(p.id));
    setModalVisible(false);
    navigation.navigate("CreateRoute", { points: selectedPoints });
  };

  if (pointsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-600 text-base">
          Chargement des points...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="header">
        <Text className="header-title-lg mb-2">Points d&apos;intérêt</Text>
        <Text className="header-subtitle">
          {sortedList.length}{" "}
          {sortedList.length > 1 ? "points enregistrés" : "point enregistré"}
        </Text>
        {/* Boutons de tri */}
        <View className="toggle-container">
          <Pressable
            onPress={() => setSortBy("recent")}
            className={
              sortBy === "recent" ? "toggle-item-active" : "toggle-item"
            }
          >
            <Text
              className={
                sortBy === "recent" ? "toggle-text-active" : "toggle-text"
              }
            >
              Plus récent
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSortBy("distance")}
            className={
              sortBy === "distance" ? "toggle-item-active" : "toggle-item"
            }
          >
            <Text
              className={
                sortBy === "distance" ? "toggle-text-active" : "toggle-text"
              }
            >
              Plus proche
            </Text>
          </Pressable>
        </View>
      </View>

      {sortedList.length === 0 && !pointsLoading ? (
        <View className="empty-state">
          <View className="empty-icon">
            <Text className="text-5xl">📍</Text>
          </View>
          <Text className="empty-title">Aucun point d&apos;intérêt</Text>
          <Text className="empty-text">
            Commencez par enregistrer votre premier point d&apos;intérêt
          </Text>
          <Pressable
            className="btn-add-point"
            onPress={() => navigation.navigate("RegisterPoint")}
          >
            <Text className="text-white font-semibold text-base">
              + Ajouter un point
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sortedList}
          keyExtractor={(item) => item.id.toString()}
          contentContainerClassName="p-4"
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <InterestPointCard
              item={item}
              index={index}
              onPress={() =>
                navigation.navigate("PointDetails", { pointId: item.id })
              }
              onDelete={() => handleDelete(item.id)}
              displayKnob={false}
            />
          )}
          ListFooterComponent={<View className="h-4" />}
        />
      )}

      {/* Persistent centered button at bottom */}
      <Pressable
        onPress={openSelectionModal}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-blue-500 rounded-full p-4 shadow-lg active:bg-blue-600"
        style={{
          transform: [{ scale: 1 }],
          zIndex: 1000,
        }}
      >
        <Text className="text-white font-bold text-lg">
          + Créer un itinéraire
        </Text>
      </Pressable>

      {/* Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          onPress={() => setModalVisible(false)}
          className="flex-1 bg-black/40 justify-center items-center"
          style={{ padding: 12 }}
        >
          <Pressable
            onPress={() => {}}
            className="bg-white rounded-2xl w-11/12 h-5/6"
            style={{ padding: 16 }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold">
                Sélectionner des points
              </Text>
              <Pressable onPress={() => setModalVisible(false)} className="p-2">
                <Text className="text-blue-600 font-semibold">Fermer</Text>
              </Pressable>
            </View>

            <FlatList
              data={sortedList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <ModalPointItem
                  item={item}
                  selected={selectedIds.includes(item.id)}
                  onToggle={() => toggleSelect(item.id)}
                />
              )}
            />

            <View className="flex-row justify-between mt-3">
              <Pressable
                onPress={() => setModalVisible(false)}
                className="modal-btn-cancel"
              >
                <Text>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={validateSelection}
                className="modal-btn-confirm"
              >
                <Text className="text-white font-semibold">
                  Valider ({selectedIds.length})
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
