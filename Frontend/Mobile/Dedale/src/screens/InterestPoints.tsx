import { View, Text, FlatList, ActivityIndicator, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState, useMemo } from "react";
import { InterestPointsType } from "../types/database";
import getDatabase from "../../assets/migrations";

import { calculateDistance, getUserLocation } from "../services/Helper";

export default function InterestPointsScreen() {
  const navigation = useNavigation<any>();
  const [listPoint, setListPoint] = useState<InterestPointsType[]>([]);
  const [sortedList, setSortedList] = useState<InterestPointsType[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'distance'>('recent');
  const db = getDatabase();
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; } | null>(null);

  const fetchInterestPoint = async () => {
    try {
      const points = db.getAllSync<InterestPointsType>(
        'SELECT * FROM point'
      );
      console.log('Points récupérés:', points);
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
      console.error('Erreur lors de la récupération de la localisation:', error);
    }
  };

  useEffect(() => {
    fetchInterestPoint();
    fetchLocation();
  }, []);

  useEffect(() => {
    fetchLocation();
    let sorted = [...listPoint];
    if (sortBy === 'recent') {
      sorted.sort((a, b) => b.id - a.id);
    } else if (sortBy === 'distance' && location) {
      sorted.sort((a, b) => {
        const distA = calculateDistance(location.longitude, location.latitude, a.x, a.y);
        const distB = calculateDistance(location.longitude, location.latitude, b.x, b.y);
        return distA - distB;
      });
    }
    setSortedList(sorted);
  }, [listPoint, sortBy]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-600 text-base">Chargement des points...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-500 pt-12 pb-6 px-4 shadow-lg">
        <Text className="text-white text-3xl font-bold mb-2">Points d'intérêt</Text>
        <Text className="text-blue-100 text-base">
          {sortedList.length} {sortedList.length > 1 ? 'points enregistrés' : 'point enregistré'}
        </Text>
        {/* Boutons de tri */}
        <View className="flex-row mt-4 bg-blue-400/50 rounded-full p-1">
          <Pressable onPress={() => setSortBy('recent')} className={`flex-1 py-2 rounded-full ${sortBy === 'recent' ? 'bg-white' : ''}`}>
            <Text className={`text-center font-semibold ${sortBy === 'recent' ? 'text-blue-600' : 'text-white'}`}>
              Plus récent
            </Text>
          </Pressable>
          <Pressable onPress={() => setSortBy('distance')} className={`flex-1 py-2 rounded-full ${sortBy === 'distance' ? 'bg-white' : ''}`}>
            <Text className={`text-center font-semibold ${sortBy === 'distance' ? 'text-blue-600' : 'text-white'}`}>
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
          <Pressable className="mt-8 bg-blue-500 px-8 py-4 rounded-full shadow-md active:bg-blue-600">
            <Text className="text-white font-semibold text-base">+ Ajouter un point</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sortedList}
          keyExtractor={(item) => item.id.toString()}
          contentContainerClassName="p-4"
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => navigation.navigate("PointDetails", { pointId: item.id })}
              className="bg-white rounded-2xl p-5 mb-4 shadow-sm active:shadow-md"
              style={{ 
                transform: [{ scale: 1 }]
              }}
            >
              {/* Badge numéro */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <View className="bg-blue-500 rounded-full w-10 h-10 items-center justify-center mr-3">
                    <Text className="text-white font-bold text-base">#{item.id}</Text>
                  </View>
                  <View>
                    <Text className="text-gray-800 font-bold text-lg">Point #{item.id}</Text>
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
                  <Text className="text-gray-600 text-xs font-medium mb-1">Coordonnées GPS</Text>
                  <View className="flex-row">
                    <View className="bg-gray-50 rounded-lg px-3 py-1 mr-2">
                      <Text className="text-gray-700 text-sm font-mono">{item.x.toFixed(4)}</Text>
                    </View>
                    <View className="bg-gray-50 rounded-lg px-3 py-1">
                      <Text className="text-gray-700 text-sm font-mono">{item.y.toFixed(4)}</Text>
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
