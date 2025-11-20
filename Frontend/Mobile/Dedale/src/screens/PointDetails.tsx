import { View, Text, ActivityIndicator, ScrollView, Image } from "react-native";
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
  const [pictures, setPictures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const fetchPoint = async () => {
    try {
      const pointInf = db.getFirstSync<PointDetailType>(
        `SELECT ip.*, ot.*, c.*, p.*, ip.id as "point_id"
         FROM point ip
         LEFT JOIN obstacle o ON ip.id = o.point_id
         LEFT JOIN obstacle_type ot ON ot.id = o.type_id
         LEFT JOIN comment c ON ip.id = c.point_id 
         LEFT JOIN picture p ON ip.id = p.point_id
         WHERE ip.id = ?`,
        [pointId]
      );
      setDetailsPoint(pointInf);

      const pictureResults = db.getAllSync(
        `SELECT * FROM picture WHERE point_id = ?`,
        [pointId]
      );
      setPictures(pictureResults);

      console.log('Point:', pointInf);
      console.log('Pictures:', pictureResults.length > 0 ? `${pictureResults.length} images found` : 'No image');
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
        <Text className="back-btn-text">←</Text>
      </Pressable>

      {detailsPoint ? (
        <View>
          <Text className="text-3xl font-bold mb-4">Point #{detailsPoint.point_id}</Text>
          
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

          {pictures.length > 0 && (
            <View className="bg-gray-100 p-4 rounded-lg mb-4">
              <Text className="text-lg font-semibold mb-2">Images</Text>
              {pictures.map((pic) => (
                <Image
                  key={pic.id}
                  source={{ uri: `data:image/jpeg;base64,${pic.image}` }}
                  style={{ width: '100%', height: 200, resizeMode: 'contain', marginBottom: 10 }}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <Text>Aucun détail disponible</Text>
      )}
    </ScrollView>
  );
}
