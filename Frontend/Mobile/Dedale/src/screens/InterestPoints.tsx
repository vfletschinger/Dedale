import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { InterestPointsType } from "../types/database";
import getDatabase from "../../assets/migrations";

export default function InterestPointsScreen() {
  const navigation = useNavigation<any>();
  const [listPoint, setListPoint] = useState<InterestPointsType[]>([]);
  const db = getDatabase();
  const [loading, setLoading] = useState(true);

  const fetchInterestePoint = async () => {
    try {
      const points = db.getAllSync<InterestPointsType>(
        "SELECT * FROM interest_points ORDER BY id DESC"
      );
      setListPoint(points);
    } catch (error) {
      console.error("Erreur lors de la récupération:", error);
      setListPoint([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterestePoint();
  }, []);

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
      <View className="bg-blue-500 pt-12 pb-6 px-4 shadow-lg">
        <Text className="text-white text-3xl font-bold mb-2">
          Points d'intérêt
        </Text>
        <Text className="text-blue-100 text-base">
          {listPoint.length}{" "}
          {listPoint.length > 1 ? "points enregistrés" : "point enregistré"}
        </Text>
      </View>

      {listPoint.length === 0 ? (
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
          <Pressable className="mt-8 bg-blue-500 px-8 py-4 rounded-full shadow-md active:bg-blue-600">
            <Text className="text-white font-semibold text-base">
              + Ajouter un point
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listPoint}
          keyExtractor={(item) => item.id.toString()}
          contentContainerClassName="p-4"
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() =>
                navigation.navigate("PointDetails", { pointId: item.id })
              }
              className="bg-white rounded-2xl p-5 mb-4 shadow-sm active:shadow-md"
              style={{
                transform: [{ scale: 1 }],
              }}
            >
              {/* Badge numéro */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <View className="bg-blue-500 rounded-full w-10 h-10 items-center justify-center mr-3">
                    <Text className="text-white font-bold text-base">
                      #{item.id}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-gray-800 font-bold text-lg">
                      Point #{item.id}
                    </Text>
                    <Text className="text-gray-500 text-xs">
                      {index === 0
                        ? "Récent"
                        : `Il y a ${index} point${index > 1 ? "s" : ""}`}
                    </Text>
                  </View>
                </View>
                <View className="bg-blue-50 rounded-full px-3 py-1">
                  <Text className="text-blue-600 text-xs font-semibold">→</Text>
                </View>
              </View>

              <View className="h-px bg-gray-100 mb-3" />
              {/* Coordonnées */}
              <View className="flex-row items-center">
                <Text className="text-2xl mr-2">📍</Text>
                <View>
                  <Text className="text-gray-600 text-xs font-medium mb-1">
                    Coordonnées GPS
                  </Text>
                  <View className="flex-row">
                    <View className="bg-gray-50 rounded-lg px-3 py-1 mr-2">
                      <Text className="text-gray-700 text-sm font-mono">
                        {item.x.toFixed(4)}
                      </Text>
                    </View>
                    <View className="bg-gray-50 rounded-lg px-3 py-1">
                      <Text className="text-gray-700 text-sm font-mono">
                        {item.y.toFixed(4)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
          ListFooterComponent={<View className="h-4" />}
        />
      )}
    </View>
  );
}
