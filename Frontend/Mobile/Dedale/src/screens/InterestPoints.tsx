import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import React, { useEffect, useState, useMemo } from "react";
import { InterestPointsType } from "../types/database";
import getDatabase from "../../assets/migrations";

import { calculateDistance, getAddressFromCoords, getUserLocation } from "../services/Helper";
import { deletePoint } from "../services/databaseAcces";
import { get } from "react-native/Libraries/TurboModule/TurboModuleRegistry";
import InterestPointCard from '../components/PointCard';

export default function InterestPointsScreen() {
  const navigation = useNavigation<any>();
  const [listPoint, setListPoint] = useState<InterestPointsType[]>([]);
  const [sortedList, setSortedList] = useState<InterestPointsType[]>([]);
  const [sortBy, setSortBy] = useState<"recent" | "distance">("recent");
  const db = getDatabase();
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const fetchInterestPoint = async () => {
    try {
      const points = db.getAllSync<InterestPointsType>("SELECT * FROM point");
      console.log("Points récupérés:", points);
      setListPoint(points);
    } catch (error) {
      setListPoint([]);
    } finally {
      setLoading(false);
    }
  };

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
      fetchInterestPoint();
      fetchLocation();
    }, [])
  );

  const handleDelete = (pointId: number) => {
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
              Alert.alert("Succès", "Point supprimé avec succès");
              fetchInterestPoint();
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
      sorted.sort((a, b) => b.id - a.id);
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

  if (loading) {
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
      <View className="bg-blue-500 pt-12 pb-6 px-4 shadow-sm">
        <Text className="text-white text-3xl font-bold mb-2">
          Points d'intérêt
        </Text>
        <Text className="text-blue-100 text-base">
          {sortedList.length}{" "}
          {sortedList.length > 1 ? "points enregistrés" : "point enregistré"}
        </Text>
        {/* Boutons de tri */}
        <View className="flex-row mt-4 bg-blue-400/50 rounded-full p-1">
          <Pressable
            onPress={() => setSortBy("recent")}
            className={`flex-1 py-2 rounded-full ${sortBy === "recent" ? "bg-white" : ""}`}
          >
            <Text
              className={`text-center font-semibold ${sortBy === "recent" ? "text-blue-600" : "text-white"}`}
            >
              Plus récent
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSortBy("distance")}
            className={`flex-1 py-2 rounded-full ${sortBy === "distance" ? "bg-white" : ""}`}
          >
            <Text
              className={`text-center font-semibold ${sortBy === "distance" ? "text-blue-600" : "text-white"}`}
            >
              Plus proche
            </Text>
          </Pressable>
        </View>
      </View>

      {sortedList.length === 0 && !loading ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-white rounded-full w-24 h-24 items-center justify-center mb-6 shadow-md">
            <Text className="text-5xl">📍</Text>
          </View>
          <Text className="text-gray-800 text-xl font-bold mb-2 text-center">
            Aucun point d'intérêt
          </Text>
          <Text className="text-gray-500 text-base text-center leading-6">
            Commencez par enregistrer votre premier point d'intérêt
          </Text>
          <Pressable className="mt-8 bg-blue-500 px-8 py-4 rounded-full shadow-md active:bg-blue-600"
            onPress={() => navigation.navigate("RegisterPoint")}>
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
              onPress={() => navigation.navigate("PointDetails", { pointId: item.id })}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          ListFooterComponent={<View className="h-4" />}
        />
      )}
    </View>
  );
}
