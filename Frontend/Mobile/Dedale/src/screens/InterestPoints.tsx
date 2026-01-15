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
import Colors from "../constants/colors";

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
      className={
        selected
          ? "flex-row items-center justify-between p-3 rounded-lg mb-2 bg-blue-50"
          : "flex-row items-center justify-between p-3 rounded-lg mb-2 bg-white"
      }
    >
      <View className="flex-1 mr-2">
        <Text className="font-medium">Point #{shortId(item.id)}</Text>
        <Text className="text-xs text-gray-500" numberOfLines={2}>
          {address}
        </Text>
      </View>
      <View className="w-8 h-8 rounded-full items-center justify-center border border-gray-300">
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
              refreshPoints();
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

  if (pointsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text className="mt-4 text-gray-600 text-base">
          Chargement des points...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary pt-4 pb-4 px-4 shadow-sm">
        <Text className="text-accent text-3xl font-bold mb-2 mt-6">
          Points d&apos;intérêt
        </Text>
        <Text className="text-accent-light text-base">
          {sortedList.length}{" "}
          {sortedList.length > 1 ? "points enregistrés" : "point enregistré"}
        </Text>
        {/* Boutons de tri */}
        <View className="flex-row mt-4 bg-blue-400/50 rounded-full p-1">
          <Pressable
            onPress={() => setSortBy("recent")}
            className={
              sortBy === "recent"
                ? "flex-1 py-2 rounded-full bg-white"
                : "flex-1 py-2 rounded-full"
            }
          >
            <Text
              className={
                sortBy === "recent"
                  ? "text-center font-semibold text-blue-600"
                  : "text-center font-semibold text-white"
              }
            >
              Plus récent
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSortBy("distance")}
            className={
              sortBy === "distance"
                ? "flex-1 py-2 rounded-full bg-white"
                : "flex-1 py-2 rounded-full"
            }
          >
            <Text
              className={
                sortBy === "distance"
                  ? "text-center font-semibold text-blue-600"
                  : "text-center font-semibold text-white"
              }
            >
              Plus proche
            </Text>
          </Pressable>
        </View>
      </View>

      {sortedList.length === 0 && !pointsLoading ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-white rounded-full w-24 h-24 items-center justify-center mb-6 shadow-md">
            <Text className="text-5xl">📍</Text>
          </View>
          <Text className="text-gray-800 text-xl font-bold mb-2 text-center">
            Aucun point d&apos;intérêt
          </Text>
          <Text className="text-gray-500 text-base text-center leading-6">
            Commencez par enregistrer votre premier point d&apos;intérêt
          </Text>
          <Pressable
            className="mt-8 bg-blue-500 px-8 py-4 rounded-full shadow-md active:bg-blue-600"
            onPress={() => navigation.navigate("Accueil")}
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
              displayCoordinates={false}
              displayDeleteButton={false}
            />
          )}
          ListFooterComponent={<View className="h-4" />}
        />
      )}
    </View>
  );
}
