import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Pressable } from "react-native";
import React, { useEffect, useState } from "react";
import { InterestPointsType } from "../types/database";
import getDatabase from "../../assets/migrations";

export default function InterestPointsScreen() {
  const navigation = useNavigation();
  const [listPoint, setListPoint] = useState<InterestPointsType[]>([]);
  const db = getDatabase();
  const [loading, setLoading] = useState(true);
  
  const fetchInterestePoint = async () => {
    try {
      const points = db.getAllSync<InterestPointsType>(
        'SELECT * FROM interest_points ORDER BY id DESC'
      );
      setListPoint(points);
    } catch (error) {
      console.error('Erreur lors de la récupération:', error);
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
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-2xl font-bold mb-4">Points d'intérêt</Text>
      
      {listPoint.length === 0 ? (
        <Text className="text-center text-gray-500 mt-8">
          Aucun point d'intérêt enregistré
        </Text>
      ) : (
        <FlatList
          data={listPoint}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate("CreateRoute" as never)}
              className="bg-blue-500 p-4 rounded-lg mb-3 active:bg-blue-600"
            >
              <Text className="text-white font-semibold text-lg">
                Point #{item.id}
              </Text>
              <Text className="text-white text-sm">
                Coordonnées: {item.x}, {item.y}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
