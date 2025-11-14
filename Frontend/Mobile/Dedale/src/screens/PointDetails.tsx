import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Pressable } from "react-native";
import React, { useEffect, useState } from "react";
import getDatabase from "../../assets/migrations";
import { PointDetailType } from "../types/database";

type RouteParams = { pointId: number; };

export default function PointDetails() {
  const db = getDatabase();
  const route = useRoute();
  const { pointId } = route.params as RouteParams;
  const navigation = useNavigation();
  const [detailsPoint, setDetailsPoint] = useState<PointDetailType | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPoint = async () => {
    console.log('Récupération du point:', pointId);
    try {
      const pointInf = db.getFirstSync<PointDetailType>(
        `SELECT ip.*, ot.*, c.*, p.*
         FROM interest_points ip
         LEFT JOIN obstacles o ON ip.id = o.point_id
         LEFT JOIN obstacle_types ot ON ot.id = o.type_id
         LEFT JOIN comments c ON ip.id = c.point_id 
         LEFT JOIN pictures p ON ip.id = p.point_id
         WHERE ip.id = ?`,
        [pointId]
      );
      console.log('Point trouvé:', pointInf);
      setDetailsPoint(pointInf);
    } catch (e) {
      console.log('Erreur:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoint();
  }, [pointId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white p-4">
      <Pressable onPress={() => navigation.goBack()} className="mb-4">
        <Text className="text-2xl">← Retour</Text>
      </Pressable>

      {detailsPoint ? (
        <View>
          <Text className="text-3xl font-bold mb-4">Point #{detailsPoint.id}</Text>
          
          <View className="bg-gray-100 p-4 rounded-lg mb-4">
            <Text className="text-lg font-semibold mb-2">Coordonnées</Text>
            <Text>X: {detailsPoint.x}</Text>
            <Text>Y: {detailsPoint.y}</Text>
          </View>

          {detailsPoint.name && (
            <View className="bg-gray-100 p-4 rounded-lg mb-4">
              <Text className="text-lg font-semibold mb-2">Nom</Text>
              <Text>{detailsPoint.name}</Text>
            </View>
          )}

          {detailsPoint.description && (
            <View className="bg-gray-100 p-4 rounded-lg mb-4">
              <Text className="text-lg font-semibold mb-2">Description</Text>
              <Text>{detailsPoint.description}</Text>
            </View>
          )}

          {detailsPoint.value && (
            <View className="bg-gray-100 p-4 rounded-lg mb-4">
              <Text className="text-lg font-semibold mb-2">Valeur</Text>
              <Text>{detailsPoint.value}</Text>
            </View>
          )}

          {(detailsPoint.length || detailsPoint.width) && (
            <View className="bg-gray-100 p-4 rounded-lg mb-4">
              <Text className="text-lg font-semibold mb-2">Dimensions</Text>
              {detailsPoint.length && <Text>Longueur: {detailsPoint.length}</Text>}
              {detailsPoint.width && <Text>Largeur: {detailsPoint.width}</Text>}
            </View>
          )}

          {detailsPoint.path && (
            <View className="bg-gray-100 p-4 rounded-lg mb-4">
              <Text className="text-lg font-semibold mb-2">Chemin</Text>
              <Text>{detailsPoint.path}</Text>
            </View>
          )}
        </View>
      ) : (
        <Text className="text-center text-gray-500 mt-8">
          Point introuvable
        </Text>
      )}
    </ScrollView>
  );
}
